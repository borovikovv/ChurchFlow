import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  BudgetAmountRow,
  BudgetCategory,
  BudgetOpeningBalance,
  BudgetCurrencyTotals,
  BudgetEntry,
  BudgetGroup,
  BudgetGroupSummary,
  BudgetMonth,
  BudgetPayload,
  CreateBudgetCategoryInput,
  CreateBudgetMonthInput,
  UpdateBudgetCategoryInput,
  UpdateBudgetEntryInput,
  UpdateBudgetEntryNoteInput,
  UpdateBudgetBaseCurrencyInput,
  UpdateBudgetOpeningBalanceInput,
} from '@churchflow/shared';
import {
  BUDGET_GROUPS,
  addCurrencyTotals,
  budgetEntryFieldSchema,
  calculateBudgetTotals,
  roundCurrencyTotals,
  subtractCurrencyTotals,
  sumBudgetTotals,
  zeroCurrencyTotals,
} from '@churchflow/shared';
import { CurrencyRatesService } from '../currency-rates/currency-rates.service';
import {
  BUDGET_GROUP_ORDER,
  BudgetsRepository,
  type BudgetMonthRecord,
} from './repositories/budgets.repository';

const EARLIEST_BUDGET_YEAR = 2000;

@Injectable()
export class BudgetsService {
  constructor(
    private readonly budgetsRepository: BudgetsRepository,
    private readonly currencyRatesService: CurrencyRatesService,
  ) {}

  async list(organizationId: string, year: number, actorUserId: string): Promise<BudgetPayload> {
    const actor = await this.budgetsRepository.findManagingMembership(organizationId, actorUserId);
    if (!actor) {
      throw new ForbiddenException('Only organization owners and admins can view budgets');
    }

    const { categories, months } = await this.budgetsRepository.listYear(organizationId, year);
    const categoryItems = categories
      .map(
        (category): BudgetCategory => ({
          id: category.id,
          group: category.group,
          type: category.type,
          name: category.name,
          order: category.order,
        }),
      )
      .sort(compareCategories);
    const monthItems = months.map((month) => mapMonth(month));
    const yearTotals = sumBudgetTotals(monthItems.map((month) => month.totals));
    const [openingBalance, rates] = await Promise.all([
      this.resolveOpeningBalance(organizationId, year),
      this.currencyRatesService.getCurrent(),
    ]);

    return {
      actorRole: actor.role as 'OWNER' | 'ADMIN',
      canManage: true,
      year,
      baseCurrency: actor.organization.baseCurrency,
      categories: categoryItems,
      months: monthItems,
      yearTotals,
      groupSummaries: buildGroupSummaries(months),
      openingBalance,
      rates,
    };
  }

  async updateBaseCurrency(
    organizationId: string,
    input: UpdateBudgetBaseCurrencyInput,
    actorUserId: string,
  ): Promise<UpdateBudgetBaseCurrencyInput> {
    try {
      return await this.budgetsRepository.updateBaseCurrency(organizationId, input, actorUserId);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async updateOpeningBalance(
    organizationId: string,
    input: UpdateBudgetOpeningBalanceInput,
    actorUserId: string,
  ): Promise<BudgetOpeningBalance> {
    try {
      await this.budgetsRepository.upsertOpeningBalance(organizationId, input, actorUserId);
    } catch (error) {
      throw this.toHttpError(error);
    }

    return this.resolveOpeningBalance(organizationId, input.sinceYear);
  }

  private async resolveOpeningBalance(
    organizationId: string,
    year: number,
  ): Promise<BudgetOpeningBalance> {
    const record = await this.budgetsRepository.findOpeningBalance(organizationId, year);
    const seed = record
      ? {
          amountUah: decimalToNumber(record.amountUah),
          amountUsd: decimalToNumber(record.amountUsd),
          amountEur: decimalToNumber(record.amountEur),
        }
      : zeroCurrencyTotals();

    const movement = await this.budgetsRepository.sumEntriesBetweenYears(
      organizationId,
      record?.sinceYear ?? EARLIEST_BUDGET_YEAR,
      year,
    );

    const opening = subtractCurrencyTotals(
      addCurrencyTotals(seed, sumToCurrencyTotals(movement.income)),
      sumToCurrencyTotals(movement.expense),
    );

    return {
      sinceYear: record?.sinceYear ?? null,
      seed: roundCurrencyTotals(seed),
      opening: roundCurrencyTotals(opening),
    };
  }

  async createMonth(
    organizationId: string,
    input: CreateBudgetMonthInput,
    actorUserId: string,
  ): Promise<BudgetMonth> {
    try {
      return mapMonth(await this.budgetsRepository.createMonth(organizationId, input, actorUserId));
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async createCategory(
    organizationId: string,
    input: CreateBudgetCategoryInput,
    actorUserId: string,
  ): Promise<BudgetCategory> {
    try {
      const category = await this.budgetsRepository.createCategory(
        organizationId,
        input,
        actorUserId,
      );

      return {
        id: category.id,
        group: category.group,
        type: category.type,
        name: category.name,
        order: category.order,
      };
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async updateCategory(
    organizationId: string,
    categoryId: string,
    input: UpdateBudgetCategoryInput,
    actorUserId: string,
  ): Promise<BudgetCategory> {
    try {
      const category = await this.budgetsRepository.updateCategory(
        organizationId,
        categoryId,
        input,
        actorUserId,
      );

      return {
        id: category.id,
        group: category.group,
        type: category.type,
        name: category.name,
        order: category.order,
      };
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async deleteCategory(organizationId: string, categoryId: string, actorUserId: string) {
    try {
      await this.budgetsRepository.deleteCategory(organizationId, categoryId, actorUserId);

      return { deletedCategoryId: categoryId };
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async deleteMonth(organizationId: string, monthId: string, actorUserId: string) {
    try {
      await this.budgetsRepository.deleteMonth(organizationId, monthId, actorUserId);

      return { deletedMonthId: monthId };
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async updateEntry(
    organizationId: string,
    monthId: string,
    categoryId: string,
    rowIndex: number,
    input: UpdateBudgetEntryInput,
    actorUserId: string,
  ): Promise<BudgetEntry> {
    try {
      const entry = await this.budgetsRepository.updateEntry(
        organizationId,
        monthId,
        categoryId,
        rowIndex,
        input,
        actorUserId,
      );

      return mapEntry(entry);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async updateEntryNote(
    organizationId: string,
    monthId: string,
    categoryId: string,
    rowIndex: number,
    field: string,
    input: UpdateBudgetEntryNoteInput,
    actorUserId: string,
  ): Promise<BudgetEntry> {
    const parsedField = budgetEntryFieldSchema.safeParse(field);
    if (!parsedField.success) {
      throw new NotFoundException('Budget entry field was not found');
    }

    try {
      const entry = await this.budgetsRepository.updateEntryNote(
        organizationId,
        monthId,
        categoryId,
        rowIndex,
        parsedField.data,
        input,
        actorUserId,
      );

      return mapEntry(entry);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async addMonthRow(
    organizationId: string,
    monthId: string,
    actorUserId: string,
  ): Promise<BudgetMonth> {
    try {
      return mapMonth(
        await this.budgetsRepository.addMonthRow(organizationId, monthId, actorUserId),
      );
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async removeLastMonthRow(
    organizationId: string,
    monthId: string,
    actorUserId: string,
  ): Promise<BudgetMonth> {
    try {
      return mapMonth(
        await this.budgetsRepository.removeLastMonthRow(organizationId, monthId, actorUserId),
      );
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private toHttpError(error: unknown) {
    if (!(error instanceof Error)) return error;
    if (error.message === 'ACTOR_CANNOT_MANAGE_BUDGET') {
      return new ForbiddenException('Only organization owners and admins can manage budgets');
    }
    if (error.message === 'BUDGET_CATEGORY_NOT_FOUND') {
      return new NotFoundException('Budget category was not found');
    }
    if (error.message === 'BUDGET_MONTH_NOT_FOUND') {
      return new NotFoundException('Budget month was not found');
    }
    if (error.message === 'BUDGET_MONTH_ROW_NOT_FOUND') {
      return new NotFoundException('Budget month row was not found');
    }
    if (error.message === 'BUDGET_MONTH_ROW_COUNT_MIN') {
      return new ConflictException('Budget month must have at least one row');
    }
    if (error.message.includes('Unique constraint failed')) {
      return new ConflictException('Budget month already exists');
    }

    return error;
  }
}

function mapMonth(month: BudgetMonthRecord): BudgetMonth {
  return {
    id: month.id,
    year: month.year,
    month: month.month,
    rowCount: month.rowCount,
    entries: month.entries.map(mapEntry),
    totals: calculateBudgetTotals(month.entries.map(toAmountRow)),
  };
}

function mapEntry(entry: BudgetMonthRecord['entries'][number]): BudgetEntry {
  return {
    id: entry.id,
    categoryId: entry.categoryId,
    rowIndex: entry.rowIndex,
    amountUah: decimalToNumber(entry.amountUah),
    amountUsd: decimalToNumber(entry.amountUsd),
    amountEur: decimalToNumber(entry.amountEur),
    notes: entry.notes.map((note) => ({ field: note.field, note: note.note })),
  };
}

function toAmountRow(entry: BudgetMonthRecord['entries'][number]): BudgetAmountRow {
  return {
    type: entry.category.type,
    amounts: {
      amountUah: decimalToNumber(entry.amountUah),
      amountUsd: decimalToNumber(entry.amountUsd),
      amountEur: decimalToNumber(entry.amountEur),
    },
  };
}

function buildGroupSummaries(months: BudgetMonthRecord[]): BudgetGroupSummary[] {
  const rowsByGroup = new Map<BudgetGroup, BudgetAmountRow[]>(
    BUDGET_GROUPS.map((group) => [group, []]),
  );

  for (const month of months) {
    for (const entry of month.entries) {
      rowsByGroup.get(entry.category.group)?.push(toAmountRow(entry));
    }
  }

  return [...rowsByGroup.entries()].map(([group, rows]) => ({
    group,
    totals: calculateBudgetTotals(rows),
  }));
}

function sumToCurrencyTotals(sum: {
  amountUah: DecimalLike | null;
  amountUsd: DecimalLike | null;
  amountEur: DecimalLike | null;
}): BudgetCurrencyTotals {
  return {
    amountUah: sum.amountUah ? decimalToNumber(sum.amountUah) : 0,
    amountUsd: sum.amountUsd ? decimalToNumber(sum.amountUsd) : 0,
    amountEur: sum.amountEur ? decimalToNumber(sum.amountEur) : 0,
  };
}

type DecimalLike = { toString(): string };

function decimalToNumber(value: DecimalLike): number {
  return Number(value.toString());
}

function compareCategories(a: BudgetCategory, b: BudgetCategory): number {
  return (
    (BUDGET_GROUP_ORDER.get(a.group) ?? 0) - (BUDGET_GROUP_ORDER.get(b.group) ?? 0) ||
    a.order - b.order ||
    a.name.localeCompare(b.name)
  );
}
