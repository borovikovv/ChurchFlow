import type {
  BudgetAmountField,
  BudgetEntry,
  BudgetExchangeInput,
  BudgetEntryField,
  BudgetMonth,
  BudgetOpeningBalance,
  BudgetPayload,
  CreateBudgetMonthInput,
  UpdateBudgetEntryInput,
  UpdateBudgetEntryNoteInput,
  UpdateBudgetBaseCurrencyInput,
  UpdateBudgetOpeningBalanceInput,
} from '@churchflow/shared';
import type { ActionResult } from '../types';

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
  createExchange: (
    organizationId: string,
    monthId: string,
    input: BudgetExchangeInput,
  ) => Promise<ActionResult<BudgetMonth>>;
  updateExchange: (
    organizationId: string,
    exchangeId: string,
    input: BudgetExchangeInput,
  ) => Promise<ActionResult<BudgetMonth>>;
  deleteExchange: (
    organizationId: string,
    exchangeId: string,
  ) => Promise<ActionResult<BudgetMonth>>;
  updateBaseCurrency: (
    organizationId: string,
    input: UpdateBudgetBaseCurrencyInput,
  ) => Promise<ActionResult<UpdateBudgetBaseCurrencyInput>>;
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
