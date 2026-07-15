import {
  createBudgetCategorySchema,
  createBudgetMonthSchema,
  listBudgetQuerySchema,
  updateBudgetCategorySchema,
  updateBudgetEntrySchema,
  updateBudgetEntryNoteSchema,
} from '@churchflow/shared';
import type {
  BudgetCategoryType,
  BudgetGroup,
  CreateBudgetCategoryInput,
  CreateBudgetMonthInput,
  ListBudgetQuery,
  UpdateBudgetCategoryInput,
  UpdateBudgetEntryInput,
  UpdateBudgetEntryNoteInput,
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
