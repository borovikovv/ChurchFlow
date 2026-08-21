import { Injectable } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import {
  BUDGET_GROUPS,
  DEFAULT_BUDGET_MONTH_ROW_COUNT,
  DEFAULT_BUDGET_CATEGORIES,
  type BudgetEntryField,
  type CreateBudgetCategoryInput,
  type CreateBudgetMonthInput,
  type UpdateBudgetEntryNoteInput,
  type UpdateBudgetCategoryInput,
  type UpdateBudgetEntryInput,
  type UpdateBudgetOpeningBalanceInput,
} from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';

const budgetMonthInclude = Prisma.validator<Prisma.BudgetMonthInclude>()({
  entries: {
    include: { category: true, notes: true },
    orderBy: [{ rowIndex: 'asc' as const }, { category: { order: 'asc' as const } }],
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
      select: { id: true, role: true },
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

      return tx.budgetOpeningBalance.upsert({
        where: {
          organizationId_sinceYear: { organizationId, sinceYear: input.sinceYear },
        },
        create: { organizationId, sinceYear: input.sinceYear, ...data },
        update: data,
      });
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
            })),
          ),
          skipDuplicates: true,
        });
      }

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
        select: { id: true },
      });
      if (!category) throw new Error('BUDGET_CATEGORY_NOT_FOUND');

      return tx.budgetCategory.update({
        where: { id: categoryId },
        data: budgetCategoryUpdateData(input),
      });
    });
  }

  async deleteCategory(organizationId: string, categoryId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);
      const category = await tx.budgetCategory.findFirst({
        where: { id: categoryId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!category) throw new Error('BUDGET_CATEGORY_NOT_FOUND');

      await tx.budgetEntry.deleteMany({ where: { categoryId } });
      return tx.budgetCategory.update({
        where: { id: categoryId },
        data: { deletedAt: new Date() },
      });
    });
  }

  async deleteMonth(organizationId: string, monthId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);
      const month = await tx.budgetMonth.findFirst({
        where: { id: monthId, organizationId },
        select: { id: true },
      });
      if (!month) throw new Error('BUDGET_MONTH_NOT_FOUND');

      return tx.budgetMonth.delete({ where: { id: monthId }, select: { id: true } });
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
      await this.assertMonthAndCategory(tx, organizationId, monthId, categoryId, rowIndex);

      const data = budgetEntryData(input);

      return tx.budgetEntry.upsert({
        where: { monthId_categoryId_rowIndex: { monthId, categoryId, rowIndex } },
        create: {
          monthId,
          categoryId,
          rowIndex,
          ...data,
        },
        update: data,
        include: { category: true, notes: true },
      });
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
      await this.assertMonthAndCategory(tx, organizationId, monthId, categoryId, rowIndex);

      const entry = await tx.budgetEntry.upsert({
        where: { monthId_categoryId_rowIndex: { monthId, categoryId, rowIndex } },
        create: { monthId, categoryId, rowIndex },
        update: {},
        select: { id: true },
      });
      const note = input.note?.trim() ?? null;

      if (!note) {
        await tx.budgetEntryNote.deleteMany({ where: { entryId: entry.id, field } });
      } else {
        await tx.budgetEntryNote.upsert({
          where: { entryId_field: { entryId: entry.id, field } },
          create: { entryId: entry.id, field, note },
          update: { note },
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
        select: { id: true, rowCount: true },
      });
      if (!month) throw new Error('BUDGET_MONTH_NOT_FOUND');

      const categories = await tx.budgetCategory.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true },
      });
      const rowIndex = month.rowCount;
      if (categories.length > 0) {
        await tx.budgetEntry.createMany({
          data: categories.map((category) => ({ monthId, categoryId: category.id, rowIndex })),
          skipDuplicates: true,
        });
      }
      await tx.budgetMonth.update({
        where: { id: monthId },
        data: { rowCount: { increment: 1 } },
      });

      return this.findMonth(tx, monthId);
    });
  }

  async removeLastMonthRow(organizationId: string, monthId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManagingActor(tx, organizationId, actorUserId);
      const month = await tx.budgetMonth.findFirst({
        where: { id: monthId, organizationId },
        select: { id: true, rowCount: true },
      });
      if (!month) throw new Error('BUDGET_MONTH_NOT_FOUND');
      if (month.rowCount <= 1) throw new Error('BUDGET_MONTH_ROW_COUNT_MIN');

      const rowIndex = month.rowCount - 1;
      await tx.budgetEntry.deleteMany({ where: { monthId, rowIndex } });
      await tx.budgetMonth.update({
        where: { id: monthId },
        data: { rowCount: { decrement: 1 } },
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
        })),
      ),
      skipDuplicates: true,
    });
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
      select: { id: true, rowCount: true },
    });
    if (!month) throw new Error('BUDGET_MONTH_NOT_FOUND');
    if (rowIndex < 0 || rowIndex >= month.rowCount) throw new Error('BUDGET_MONTH_ROW_NOT_FOUND');

    const category = await tx.budgetCategory.findFirst({
      where: { id: categoryId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw new Error('BUDGET_CATEGORY_NOT_FOUND');
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
