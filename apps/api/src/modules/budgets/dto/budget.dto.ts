import {
  budgetExchangeSchema,
  createBudgetCategorySchema,
  createBudgetMonthSchema,
  listBudgetQuerySchema,
  updateBudgetCategorySchema,
  updateBudgetEntrySchema,
  updateBudgetEntryNoteSchema,
  updateBudgetBaseCurrencySchema,
  updateBudgetOpeningBalanceSchema,
} from '@churchflow/shared';
import type {
  BudgetCategoryType,
  BudgetCurrency,
  BudgetExchangeInput,
  BudgetGroup,
  CreateBudgetCategoryInput,
  CreateBudgetMonthInput,
  ListBudgetQuery,
  UpdateBudgetCategoryInput,
  UpdateBudgetEntryInput,
  UpdateBudgetEntryNoteInput,
  UpdateBudgetBaseCurrencyInput,
  UpdateBudgetOpeningBalanceInput,
} from '@churchflow/shared';

export class ListBudgetQueryDto implements ListBudgetQuery {
  static readonly schema = listBudgetQuerySchema;

  year!: number;
}

export class CreateBudgetMonthDto implements CreateBudgetMonthInput {
  static readonly schema = createBudgetMonthSchema;

  year!: number;
  month!: number;
}

export class CreateBudgetCategoryDto implements CreateBudgetCategoryInput {
  static readonly schema = createBudgetCategorySchema;

  group!: BudgetGroup;
  type!: BudgetCategoryType;
  name!: string;
}

export class UpdateBudgetCategoryDto implements UpdateBudgetCategoryInput {
  static readonly schema = updateBudgetCategorySchema;

  name?: string;
  type?: BudgetCategoryType;
  order?: number;
}

export class UpdateBudgetEntryDto implements UpdateBudgetEntryInput {
  static readonly schema = updateBudgetEntrySchema;

  amountUah?: number;
  amountUsd?: number;
  amountEur?: number;
}

export class UpdateBudgetEntryNoteDto implements UpdateBudgetEntryNoteInput {
  static readonly schema = updateBudgetEntryNoteSchema;

  note!: string | null;
}

export class BudgetExchangeDto implements BudgetExchangeInput {
  static readonly schema = budgetExchangeSchema;

  occurredOn!: string;
  fromCurrency!: BudgetCurrency;
  fromAmount!: number;
  toCurrency!: BudgetCurrency;
  toAmount!: number;
  note!: string | null;
}

export class UpdateBudgetBaseCurrencyDto implements UpdateBudgetBaseCurrencyInput {
  static readonly schema = updateBudgetBaseCurrencySchema;

  baseCurrency!: BudgetCurrency;
}

export class UpdateBudgetOpeningBalanceDto implements UpdateBudgetOpeningBalanceInput {
  static readonly schema = updateBudgetOpeningBalanceSchema;

  sinceYear!: number;
  amountUah!: number;
  amountUsd!: number;
  amountEur!: number;
}
