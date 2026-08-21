import type {
  BudgetEntry,
  BudgetEntryField,
  BudgetMonth,
  BudgetOpeningBalance,
  BudgetPayload,
  CreateBudgetMonthInput,
  UpdateBudgetEntryInput,
  UpdateBudgetEntryNoteInput,
  UpdateBudgetOpeningBalanceInput,
} from '@churchflow/shared';
import type { ActionResult } from '../types';
import type { BudgetAmountField } from './budget-table-helpers';

export type BudgetManagerProps = {
  organizationId: string;
  payload: BudgetPayload;
  createMonth: (
    organizationId: string,
    input: CreateBudgetMonthInput,
  ) => Promise<ActionResult<BudgetMonth>>;
  deleteMonth: (
    organizationId: string,
    monthId: string,
  ) => Promise<ActionResult<{ deletedMonthId: string }>>;
  loadYear: (organizationId: string, year: number) => Promise<ActionResult<BudgetPayload>>;
  addMonthRow: (organizationId: string, monthId: string) => Promise<ActionResult<BudgetMonth>>;
  removeLastMonthRow: (
    organizationId: string,
    monthId: string,
  ) => Promise<ActionResult<BudgetMonth>>;
  updateEntry: (
    organizationId: string,
    monthId: string,
    categoryId: string,
    rowIndex: number,
    input: UpdateBudgetEntryInput,
  ) => Promise<ActionResult<BudgetEntry>>;
  updateEntryNote: (
    organizationId: string,
    monthId: string,
    categoryId: string,
    rowIndex: number,
    field: BudgetEntryField,
    input: UpdateBudgetEntryNoteInput,
  ) => Promise<ActionResult<BudgetEntry>>;
  updateOpeningBalance: (
    organizationId: string,
    input: UpdateBudgetOpeningBalanceInput,
  ) => Promise<ActionResult<BudgetOpeningBalance>>;
};

export type BudgetEntryBlurHandler = (
  monthId: string,
  categoryId: string,
  rowIndex: number,
  field: BudgetAmountField,
  rawValue: string,
) => void;

export type BudgetEntryNoteSaveHandler = (
  monthId: string,
  categoryId: string,
  rowIndex: number,
  field: BudgetEntryField,
  note: string | null,
) => void;
