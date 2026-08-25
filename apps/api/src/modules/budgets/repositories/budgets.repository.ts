import { Injectable } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import {
  BUDGET_GROUPS,
  DEFAULT_BUDGET_MONTH_ROW_COUNT,
  DEFAULT_BUDGET_CATEGORIES,
  type BudgetEntryField,
  type BudgetExchangeInput,
  type CreateBudgetCategoryInput,
  type CreateBudgetMonthInput,
  type UpdateBudgetEntryNoteInput,
  type UpdateBudgetBaseCurrencyInput,
  type UpdateBudgetCategoryInput,
  type UpdateBudgetEntryInput,
  type UpdateBudgetOpeningBalanceInput,
} from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  BUDGET_AUDIT_ENTITY_TYPE,
  buildBudgetAmountChanges,
  changedCategoryFields,
} from '../budget-audit-metadata';

const budgetMonthInclude = Prisma.validator<Prisma.BudgetMonthInclude>()({
  entries: {
    include: { category: true, notes: true },
    orderBy: [{ rowIndex: 'asc' as const }, { category: { order: 'asc' as const } }],
  },
  exchanges: {
    orderBy: [{ occurredOn: 'asc' as const }, { createdAt: 'asc' as const }],
  },
});

export type BudgetMonthRecord = Prisma.BudgetMonthGetPayload<{
  include: typeof budgetMonthInclude;
}>;

@Injectable()
export class BudgetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManagingMembership(organizationId: string, actorUserId: string) {
    return this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: actorUserId,
        role: { in: ['OWNER', 'ADMIN'] },
        status: 'ACTIVE',
        removedAt: null,
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true, role: true, organization: { select: { baseCurrency: true } } },
    });
  }

  async updateBaseCurrency(
    organizationId: string,
    input: UpdateBudgetBaseCurrencyInput,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);

      const previous = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { baseCurrency: true },
      });
      const organization = await tx.organization.update({
        where: { id: organizationId },
        data: { baseCurrency: input.baseCurrency },
        select: { baseCurrency: true },
      });

      if (previous.baseCurrency !== organization.baseCurrency) {
        await this.recordBudgetAudit(tx, {
          organizationId,
          actorUserId,
          action: 'UPDATE_BUDGET_BASE_CURRENCY',
          entityId: organizationId,
          metadata: { from: previous.baseCurrency, to: organization.baseCurrency },
        });
      }

      return organization;
    });
  }

  async listYear(organizationId: string, year: number) {
    await this.ensureDefaultCategories(organizationId);
    const [categories, months] = await Promise.all([
      this.listCategories(organizationId),
      this.prisma.budgetMonth.findMany({
        where: { organizationId, year },
        include: budgetMonthInclude,
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
    ]);

    await this.ensureMonthEntries(
      organizationId,
      months,
      categories.map((category) => category.id),
    );

    return {
      categories,
      months: await this.prisma.budgetMonth.findMany({
        where: { organizationId, year },
        include: budgetMonthInclude,
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
    };
  }

  findOpeningBalance(organizationId: string, year: number) {
    return this.prisma.budgetOpeningBalance.findFirst({
      where: { organizationId, sinceYear: { lte: year } },
      orderBy: { sinceYear: 'desc' },
    });
  }

  async sumEntriesBetweenYears(organizationId: string, fromYear: number, toYear: number) {
    if (toYear <= fromYear) {
      return { income: zeroAmounts(), expense: zeroAmounts() };
    }

    const amounts = { amountUah: true, amountUsd: true, amountEur: true } as const;
    const monthFilter = { organizationId, year: { gte: fromYear, lt: toYear } };
    const [income, expense] = await Promise.all([
      this.prisma.budgetEntry.aggregate({
        _sum: amounts,
        where: { category: { type: 'INCOME' }, month: monthFilter },
      }),
      this.prisma.budgetEntry.aggregate({
        _sum: amounts,
        where: { category: { type: 'EXPENSE' }, month: monthFilter },
      }),
    ]);

    return { income: income._sum, expense: expense._sum };
  }

  async sumExchangesBetweenYears(organizationId: string, fromYear: number, toYear: number) {
    if (toYear <= fromYear) {
      return { outgoing: [], incoming: [] };
    }

    const where = { organizationId, month: { year: { gte: fromYear, lt: toYear } } };
    const [outgoing, incoming] = await Promise.all([
      this.prisma.budgetExchange.groupBy({
        by: ['fromCurrency'],
        _sum: { fromAmount: true },
        where,
      }),
      this.prisma.budgetExchange.groupBy({
        by: ['toCurrency'],
        _sum: { toAmount: true },
        where,
      }),
    ]);

    return {
      outgoing: outgoing.map((row) => ({
        currency: row.fromCurrency,
        amount: row._sum.fromAmount,
      })),
      incoming: incoming.map((row) => ({ currency: row.toCurrency, amount: row._sum.toAmount })),
    };
  }

  async createExchange(
    organizationId: string,
    monthId: string,
    input: BudgetExchangeInput,
    officialRate: number | null,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);
      const month = await this.assertExchangeMonth(tx, organizationId, monthId, input.occurredOn);

      const exchange = await tx.budgetExchange.create({
        data: {
          organizationId,
          monthId,
          ...budgetExchangeData(input, officialRate),
        },
      });

      await this.recordBudgetAudit(tx, {
        organizationId,
        actorUserId,
        action: 'CREATE_BUDGET_EXCHANGE',
        entityId: exchange.id,
        metadata: budgetExchangeAuditMetadata(month, input),
      });

      return this.findMonth(tx, monthId);
    });
  }

  async updateExchange(
    organizationId: string,
    exchangeId: string,
    input: BudgetExchangeInput,
    officialRate: number | null,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);
      const existing = await tx.budgetExchange.findFirst({
        where: { id: exchangeId, organizationId },
        select: { id: true, monthId: true },
      });
      if (!existing) throw new Error('BUDGET_EXCHANGE_NOT_FOUND');

      const month = await this.assertExchangeMonth(
        tx,
        organizationId,
        existing.monthId,
        input.occurredOn,
      );

      await tx.budgetExchange.update({
        where: { id: exchangeId },
        data: budgetExchangeData(input, officialRate),
      });

      await this.recordBudgetAudit(tx, {
        organizationId,
        actorUserId,
        action: 'UPDATE_BUDGET_EXCHANGE',
        entityId: exchangeId,
        metadata: budgetExchangeAuditMetadata(month, input),
      });

      return this.findMonth(tx, existing.monthId);
    });
  }

  async deleteExchange(organizationId: string, exchangeId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);
      const existing = await tx.budgetExchange.findFirst({
        where: { id: exchangeId, organizationId },
        select: { id: true, monthId: true, month: { select: { year: true, month: true } } },
      });
      if (!existing) throw new Error('BUDGET_EXCHANGE_NOT_FOUND');

      await tx.budgetExchange.delete({ where: { id: exchangeId } });

      await this.recordBudgetAudit(tx, {
        organizationId,
        actorUserId,
        action: 'DELETE_BUDGET_EXCHANGE',
        entityId: exchangeId,
        metadata: { year: existing.month.year, month: existing.month.month },
      });

      return this.findMonth(tx, existing.monthId);
    });
  }

  async upsertOpeningBalance(
    organizationId: string,
    input: UpdateBudgetOpeningBalanceInput,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);

      const data = {
        amountUah: input.amountUah,
        amountUsd: input.amountUsd,
        amountEur: input.amountEur,
      };
      const previous = await tx.budgetOpeningBalance.findUnique({
        where: {
          organizationId_sinceYear: { organizationId, sinceYear: input.sinceYear },
        },
        select: { amountUah: true, amountUsd: true, amountEur: true },
      });
      const changes = buildBudgetAmountChanges(previous, data);

      const balance = await tx.budgetOpeningBalance.upsert({
        where: {
          organizationId_sinceYear: { organizationId, sinceYear: input.sinceYear },
        },
        create: { organizationId, sinceYear: input.sinceYear, ...data },
        update: data,
      });

      if (changes.length > 0) {
        await this.recordBudgetAudit(tx, {
          organizationId,
          actorUserId,
          action: 'UPDATE_BUDGET_OPENING_BALANCE',
          entityId: balance.id,
          metadata: { sinceYear: input.sinceYear, changes },
        });
      }

      return balance;
    });
  }

  async createMonth(organizationId: string, input: CreateBudgetMonthInput, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);
      const categories = await this.ensureDefaultCategories(organizationId, tx);

      const month = await tx.budgetMonth.create({
        data: {
          organizationId,
          year: input.year,
          month: input.month,
          rowCount: DEFAULT_BUDGET_MONTH_ROW_COUNT,
          entries: {
            createMany: {
              data: createBlankEntryRows(
                categories.map((category) => category.id),
                DEFAULT_BUDGET_MONTH_ROW_COUNT,
              ),
            },
          },
        },
        include: budgetMonthInclude,
      });

      await this.recordBudgetAudit(tx, {
        organizationId,
        actorUserId,
        action: 'CREATE_BUDGET_MONTH',
        entityId: month.id,
        metadata: { year: month.year, month: month.month },
      });

      return month;
    });
  }

  async createCategory(
    organizationId: string,
    input: CreateBudgetCategoryInput,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);
      const order = await tx.budgetCategory.count({
        where: { organizationId, group: input.group, deletedAt: null },
      });
      const category = await tx.budgetCategory.create({
        data: {
          organizationId,
          group: input.group,
          type: input.type,
          name: input.name,
          order,
        },
      });
      const months = await tx.budgetMonth.findMany({
        where: { organizationId },
        select: { id: true, rowCount: true },
      });
      if (months.length > 0) {
        await tx.budgetEntry.createMany({
          data: months.flatMap((month) =>
            createBlankEntryRows([category.id], month.rowCount).map((entry) => ({
              ...entry,
              monthId: month.id,
              organizationId,
            })),
          ),
          skipDuplicates: true,
        });
      }

      await this.recordBudgetAudit(tx, {
        organizationId,
        actorUserId,
        action: 'CREATE_BUDGET_CATEGORY',
        entityId: category.id,
        metadata: { name: category.name, group: category.group, type: category.type },
      });

      return category;
    });
  }

  async updateCategory(
    organizationId: string,
    categoryId: string,
    input: UpdateBudgetCategoryInput,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);
      const category = await tx.budgetCategory.findFirst({
        where: { id: categoryId, organizationId, deletedAt: null },
        select: { id: true, name: true, type: true, order: true },
      });
      if (!category) throw new Error('BUDGET_CATEGORY_NOT_FOUND');

      const changedFields = changedCategoryFields(category, input);

      const updated = await tx.budgetCategory.update({
        where: { id: categoryId },
        data: budgetCategoryUpdateData(input),
      });

      if (changedFields.length > 0) {
        await this.recordBudgetAudit(tx, {
          organizationId,
          actorUserId,
          action: 'UPDATE_BUDGET_CATEGORY',
          entityId: updated.id,
          metadata: { name: updated.name, changedFields },
        });
      }

      return updated;
    });
  }

  async deleteCategory(organizationId: string, categoryId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);
      const category = await tx.budgetCategory.findFirst({
        where: { id: categoryId, organizationId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!category) throw new Error('BUDGET_CATEGORY_NOT_FOUND');

      await tx.budgetEntry.deleteMany({ where: { categoryId } });
      const deleted = await tx.budgetCategory.update({
        where: { id: categoryId },
        data: { deletedAt: new Date() },
      });

      await this.recordBudgetAudit(tx, {
        organizationId,
        actorUserId,
        action: 'DELETE_BUDGET_CATEGORY',
        entityId: deleted.id,
        metadata: { name: category.name },
      });

      return deleted;
    });
  }

  async deleteMonth(organizationId: string, monthId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);
      const month = await tx.budgetMonth.findFirst({
        where: { id: monthId, organizationId },
        select: { id: true, year: true, month: true },
      });
      if (!month) throw new Error('BUDGET_MONTH_NOT_FOUND');

      const deleted = await tx.budgetMonth.delete({
        where: { id: monthId },
        select: { id: true },
      });

      await this.recordBudgetAudit(tx, {
        organizationId,
        actorUserId,
        action: 'DELETE_BUDGET_MONTH',
        entityId: deleted.id,
        metadata: { year: month.year, month: month.month },
      });

      return deleted;
    });
  }

  async updateEntry(
    organizationId: string,
    monthId: string,
    categoryId: string,
    rowIndex: number,
    input: UpdateBudgetEntryInput,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);
      const { month, category } = await this.assertMonthAndCategory(
        tx,
        organizationId,
        monthId,
        categoryId,
        rowIndex,
      );

      const data = budgetEntryData(input);
      const previous = await tx.budgetEntry.findUnique({
        where: { monthId_categoryId_rowIndex: { monthId, categoryId, rowIndex } },
        select: { amountUah: true, amountUsd: true, amountEur: true },
      });
      const changes = buildBudgetAmountChanges(previous, data);

      const entry = await tx.budgetEntry.upsert({
        where: { monthId_categoryId_rowIndex: { monthId, categoryId, rowIndex } },
        create: {
          monthId,
          categoryId,
          rowIndex,
          organizationId,
          ...data,
        },
        update: data,
        include: { category: true, notes: true },
      });

      if (changes.length > 0) {
        await this.recordBudgetAudit(tx, {
          organizationId,
          actorUserId,
          action: 'UPDATE_BUDGET_ENTRY',
          entityId: entry.id,
          metadata: {
            year: month.year,
            month: month.month,
            categoryId,
            categoryName: category.name,
            rowIndex,
            changes,
          },
        });
      }

      return entry;
    });
  }

  async updateEntryNote(
    organizationId: string,
    monthId: string,
    categoryId: string,
    rowIndex: number,
    field: BudgetEntryField,
    input: UpdateBudgetEntryNoteInput,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);
      const { month, category } = await this.assertMonthAndCategory(
        tx,
        organizationId,
        monthId,
        categoryId,
        rowIndex,
      );

      const entry = await tx.budgetEntry.upsert({
        where: { monthId_categoryId_rowIndex: { monthId, categoryId, rowIndex } },
        create: { monthId, categoryId, rowIndex, organizationId },
        update: {},
        select: { id: true },
      });
      const note = input.note?.trim() ?? null;
      const previousNote = await tx.budgetEntryNote.findUnique({
        where: { entryId_field: { entryId: entry.id, field } },
        select: { note: true },
      });

      if (!note) {
        await tx.budgetEntryNote.deleteMany({ where: { entryId: entry.id, field } });
      } else {
        await tx.budgetEntryNote.upsert({
          where: { entryId_field: { entryId: entry.id, field } },
          create: { entryId: entry.id, field, note },
          update: { note },
        });
      }

      if ((previousNote?.note ?? null) !== note) {
        await this.recordBudgetAudit(tx, {
          organizationId,
          actorUserId,
          action: 'UPDATE_BUDGET_ENTRY_NOTE',
          entityId: entry.id,
          metadata: {
            year: month.year,
            month: month.month,
            categoryId,
            categoryName: category.name,
            rowIndex,
            field,
            hadNote: previousNote !== null,
            hasNote: note !== null,
          },
        });
      }

      return this.findEntry(tx, entry.id);
    });
  }

  async addMonthRow(organizationId: string, monthId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);
      const month = await tx.budgetMonth.findFirst({
        where: { id: monthId, organizationId },
        select: { id: true, rowCount: true, year: true, month: true },
      });
      if (!month) throw new Error('BUDGET_MONTH_NOT_FOUND');

      const categories = await tx.budgetCategory.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true },
      });
      const rowIndex = month.rowCount;
      if (categories.length > 0) {
        await tx.budgetEntry.createMany({
          data: categories.map((category) => ({
            monthId,
            categoryId: category.id,
            rowIndex,
            organizationId,
          })),
          skipDuplicates: true,
        });
      }
      await tx.budgetMonth.update({
        where: { id: monthId },
        data: { rowCount: { increment: 1 } },
      });

      await this.recordBudgetAudit(tx, {
        organizationId,
        actorUserId,
        action: 'ADD_BUDGET_ROW',
        entityId: month.id,
        metadata: {
          year: month.year,
          month: month.month,
          rowIndex,
          rowCount: month.rowCount + 1,
        },
      });

      return this.findMonth(tx, monthId);
    });
  }

  async removeLastMonthRow(organizationId: string, monthId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);
      const month = await tx.budgetMonth.findFirst({
        where: { id: monthId, organizationId },
        select: { id: true, rowCount: true, year: true, month: true },
      });
      if (!month) throw new Error('BUDGET_MONTH_NOT_FOUND');
      if (month.rowCount <= 1) throw new Error('BUDGET_MONTH_ROW_COUNT_MIN');

      const rowIndex = month.rowCount - 1;
      await tx.budgetEntry.deleteMany({ where: { monthId, rowIndex } });
      await tx.budgetMonth.update({
        where: { id: monthId },
        data: { rowCount: { decrement: 1 } },
      });

      await this.recordBudgetAudit(tx, {
        organizationId,
        actorUserId,
        action: 'REMOVE_BUDGET_ROW',
        entityId: month.id,
        metadata: {
          year: month.year,
          month: month.month,
          rowIndex,
          rowCount: month.rowCount - 1,
        },
      });

      return this.findMonth(tx, monthId);
    });
  }

  private async listCategories(organizationId: string) {
    return this.prisma.budgetCategory.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ group: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // Seeds the default catalogue on read. Deliberately not audited: it has no acting user and
  // would add a create event for every category the first time an organization opens the budget.
  private async ensureDefaultCategories(
    organizationId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const existingCategories = await tx.budgetCategory.findMany({
      where: { organizationId, deletedAt: null },
      select: { group: true, name: true, type: true },
    });
    const existingKeys = new Set(
      existingCategories.map((category) =>
        budgetCategoryKey(category.group, category.type, category.name),
      ),
    );
    const missingCategories = DEFAULT_BUDGET_CATEGORIES.filter(
      (category) =>
        !existingKeys.has(budgetCategoryKey(category.group, category.type, category.name)),
    );

    if (missingCategories.length > 0) {
      await tx.budgetCategory.createMany({
        data: missingCategories.map((category, index) => ({
          organizationId,
          group: category.group,
          type: category.type,
          name: category.name,
          order: existingCategories.length + index,
        })),
      });
    }

    return tx.budgetCategory.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ group: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  private async ensureMonthEntries(
    organizationId: string,
    months: Array<{ id: string; rowCount: number }>,
    categoryIds: string[],
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    if (months.length === 0 || categoryIds.length === 0) return;

    await tx.budgetEntry.createMany({
      data: months.flatMap((month) =>
        createBlankEntryRows(categoryIds, month.rowCount).map((entry) => ({
          ...entry,
          monthId: month.id,
          organizationId,
        })),
      ),
      skipDuplicates: true,
    });
  }

  private async assertExchangeMonth(
    tx: Prisma.TransactionClient,
    organizationId: string,
    monthId: string,
    occurredOn: string,
  ) {
    const month = await tx.budgetMonth.findFirst({
      where: { id: monthId, organizationId },
      select: { id: true, year: true, month: true },
    });
    if (!month) throw new Error('BUDGET_MONTH_NOT_FOUND');

    const [year, monthNumber] = occurredOn.split('-').map(Number);
    if (year !== month.year || monthNumber !== month.month) {
      throw new Error('BUDGET_EXCHANGE_DATE_OUTSIDE_MONTH');
    }

    return month;
  }

  private async assertMonthAndCategory(
    tx: Prisma.TransactionClient,
    organizationId: string,
    monthId: string,
    categoryId: string,
    rowIndex: number,
  ) {
    const month = await tx.budgetMonth.findFirst({
      where: { id: monthId, organizationId },
      select: { id: true, rowCount: true, year: true, month: true },
    });
    if (!month) throw new Error('BUDGET_MONTH_NOT_FOUND');
    if (rowIndex < 0 || rowIndex >= month.rowCount) throw new Error('BUDGET_MONTH_ROW_NOT_FOUND');

    const category = await tx.budgetCategory.findFirst({
      where: { id: categoryId, organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!category) throw new Error('BUDGET_CATEGORY_NOT_FOUND');

    return { month, category };
  }

  private recordBudgetAudit(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      actorUserId: string;
      action: string;
      entityId: string;
      metadata: Prisma.InputJsonObject;
    },
  ) {
    return tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: BUDGET_AUDIT_ENTITY_TYPE,
        entityId: input.entityId,
        metadata: input.metadata,
      },
    });
  }

  private async findEntry(tx: Prisma.TransactionClient, entryId: string) {
    return tx.budgetEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: { category: true, notes: true },
    });
  }

  private async findMonth(tx: Prisma.TransactionClient, monthId: string) {
    return tx.budgetMonth.findUniqueOrThrow({
      where: { id: monthId },
      include: budgetMonthInclude,
    });
  }

  private async assertManagingActor(
    tx: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
  ) {
    const membership = await tx.organizationMember.findFirst({
      where: {
        organizationId,
        userId: actorUserId,
        role: { in: ['OWNER', 'ADMIN'] },
        status: 'ACTIVE',
        removedAt: null,
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true },
    });
    if (!membership) throw new Error('ACTOR_CANNOT_MANAGE_BUDGET');
  }
}

export const BUDGET_GROUP_ORDER = new Map(BUDGET_GROUPS.map((group, index) => [group, index]));

function budgetCategoryKey(group: string, type: string, name: string): string {
  return `${group}:${type}:${name.trim().toLowerCase()}`;
}

function createBlankEntryRows(categoryIds: string[], rowCount: number) {
  return categoryIds.flatMap((categoryId) =>
    Array.from({ length: rowCount }, (_, rowIndex) => ({ categoryId, rowIndex })),
  );
}

function budgetCategoryUpdateData(
  input: UpdateBudgetCategoryInput,
): Prisma.BudgetCategoryUpdateInput {
  const data: Prisma.BudgetCategoryUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.type !== undefined) data.type = input.type;
  if (input.order !== undefined) data.order = input.order;
  return data;
}

type BudgetEntryPatchData = {
  amountUah?: number;
  amountUsd?: number;
  amountEur?: number;
};

function budgetExchangeData(input: BudgetExchangeInput, officialRate: number | null) {
  return {
    occurredOn: new Date(`${input.occurredOn}T00:00:00.000Z`),
    fromCurrency: input.fromCurrency,
    fromAmount: input.fromAmount,
    toCurrency: input.toCurrency,
    toAmount: input.toAmount,
    dealRate: input.toAmount / input.fromAmount,
    officialRate,
    note: input.note,
  };
}

function budgetExchangeAuditMetadata(
  month: { year: number; month: number },
  input: BudgetExchangeInput,
): Prisma.InputJsonObject {
  return {
    year: month.year,
    month: month.month,
    occurredOn: input.occurredOn,
    from: `${input.fromAmount.toFixed(2)} ${input.fromCurrency}`,
    to: `${input.toAmount.toFixed(2)} ${input.toCurrency}`,
  };
}

function budgetEntryData(input: UpdateBudgetEntryInput): BudgetEntryPatchData {
  const data: BudgetEntryPatchData = {};
  if (input.amountUah !== undefined) data.amountUah = input.amountUah;
  if (input.amountUsd !== undefined) data.amountUsd = input.amountUsd;
  if (input.amountEur !== undefined) data.amountEur = input.amountEur;
  return data;
}

function zeroAmounts() {
  return { amountUah: null, amountUsd: null, amountEur: null };
}
