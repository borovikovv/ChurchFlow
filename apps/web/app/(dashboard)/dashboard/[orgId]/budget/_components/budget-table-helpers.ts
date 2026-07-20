import {
  BUDGET_ENTRY_FIELD,
  BUDGET_GROUPS,
  type BudgetCategory,
  type BudgetCurrencyTotals,
  type BudgetEntry,
  type BudgetEntryField,
  type BudgetGroup,
  type BudgetMonth,
  type BudgetTotals,
} from '@churchflow/shared';
import { BUDGET_START_YEAR, BUDGET_YEAR_LOOKAHEAD } from '../constants';

export const GROUP_LABELS: Record<BudgetGroup, string> = {
  INCOME: 'Income',
  CURRENCY_EXCHANGE: 'Currency exchange',
  FACILITY: 'Facility',
  TABLES: 'Tables',
  PASTORS: 'Pastors',
  DISCIPLESHIP: 'Discipleship',
  EVANGELISM: 'Evangelism',
  OTHER: 'Other',
};

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export type BudgetAmountField = 'amountUah' | 'amountUsd' | 'amountEur';

export type BudgetSpreadsheetColumn = {
  id: string;
  label: string;
  category: BudgetCategory;
  field: BudgetAmountField;
  noteField: BudgetEntryField;
};

export function formatMoney(value: number, currency: 'UAH' | 'USD' | 'EUR'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatAmount(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export function formatTotalsInline(totals: BudgetCurrencyTotals): string {
  return [
    formatMoney(totals.amountUah, 'UAH'),
    formatMoney(totals.amountUsd, 'USD'),
    formatMoney(totals.amountEur, 'EUR'),
  ].join(' / ');
}

export function yearOptions(selectedYear: number): number[] {
  const currentYear = new Date().getFullYear();
  const maxBudgetYear = currentYear + BUDGET_YEAR_LOOKAHEAD;
  const years = new Set<number>();
  for (let year = BUDGET_START_YEAR; year <= maxBudgetYear; year += 1) years.add(year);
  if (selectedYear >= BUDGET_START_YEAR) years.add(selectedYear);
  return [...years].sort((a, b) => b - a);
}

export function availableMonths(months: BudgetMonth[]): number[] {
  const existing = new Set(months.map((month) => month.month));
  return Array.from({ length: 12 }, (_, index) => index + 1).filter(
    (month) => !existing.has(month),
  );
}

export function firstAvailableMonth(months: BudgetMonth[]): number | null {
  return availableMonths(months)[0] ?? null;
}

export function emptyEntry(categoryId: string, rowIndex: number): BudgetEntry {
  return {
    id: `local-${categoryId}-${rowIndex}`,
    categoryId,
    rowIndex,
    amountUah: 0,
    amountUsd: 0,
    amountEur: 0,
    notes: [],
  };
}

export function upsertEntry(entries: BudgetEntry[], entry: BudgetEntry): BudgetEntry[] {
  const exists = entries.some(
    (item) => item.categoryId === entry.categoryId && item.rowIndex === entry.rowIndex,
  );
  return exists
    ? entries.map((item) =>
        item.categoryId === entry.categoryId && item.rowIndex === entry.rowIndex ? entry : item,
      )
    : [...entries, entry];
}

export function findEntry(month: BudgetMonth, categoryId: string, rowIndex: number): BudgetEntry {
  return (
    month.entries.find((entry) => entry.categoryId === categoryId && entry.rowIndex === rowIndex) ??
    emptyEntry(categoryId, rowIndex)
  );
}

export function spreadsheetColumns(categories: BudgetCategory[]): BudgetSpreadsheetColumn[] {
  const incomeCategories = categories
    .filter((category) => category.type === 'INCOME')
    .sort(compareCategories);
  const expenseCategories = categories
    .filter((category) => category.type === 'EXPENSE')
    .sort(compareCategories);

  return [
    columnForIncome(incomeCategories, 'Office rent income', 'Office rent', 'amountUah'),
    columnForIncome(incomeCategories, 'Offerings and donations', 'Donations', 'amountUah'),
    columnForIncome(incomeCategories, 'USD income', 'USD income', 'amountUsd'),
    columnForIncome(incomeCategories, 'EUR income', 'EUR income', 'amountEur'),
    ...BUDGET_GROUPS.filter((group) => group !== 'INCOME').flatMap((group) => {
      const category = expenseCategories.find((item) => item.group === group);
      return category
        ? [
            {
              id: `expense-${group}`,
              label: GROUP_LABELS[group],
              category,
              field: 'amountUah' as const,
              noteField: BUDGET_ENTRY_FIELD.amountUah,
            },
          ]
        : [];
    }),
  ].filter((column): column is BudgetSpreadsheetColumn => Boolean(column));
}

export function noteForField(entry: BudgetEntry, field: BudgetEntryField): string | null {
  return entry.notes.find((note) => note.field === field)?.note ?? null;
}

export function monthHasDataInRow(month: BudgetMonth, rowIndex: number): boolean {
  return month.entries.some(
    (entry) =>
      entry.rowIndex === rowIndex &&
      (entry.amountUah > 0 || entry.amountUsd > 0 || entry.amountEur > 0 || entry.notes.length > 0),
  );
}

export function columnTotal(month: BudgetMonth, column: BudgetSpreadsheetColumn): number {
  return month.entries
    .filter((entry) => entry.categoryId === column.category.id)
    .reduce((total, entry) => total + entry[column.field], 0);
}

export function recalculateMonth(month: BudgetMonth, categories: BudgetCategory[]): BudgetMonth {
  return { ...month, totals: calculateMonthTotals(month, categories) };
}

export function buildGroupSummaries(months: BudgetMonth[], categories: BudgetCategory[]) {
  return BUDGET_GROUPS.map((group) => ({
    group,
    totals: sumTotals(
      months.map((month) =>
        calculateMonthTotals(
          {
            ...month,
            entries: month.entries.filter((entry) => {
              const category = categories.find((item) => item.id === entry.categoryId);
              return category?.group === group;
            }),
          },
          categories,
        ),
      ),
    ),
  }));
}

export function sumTotals(items: BudgetTotals[]): BudgetTotals {
  const totals = zeroTotals();
  for (const item of items) {
    addCurrencyTotals(totals.income, item.income);
    addCurrencyTotals(totals.expense, item.expense);
  }
  totals.balance = subtractCurrencyTotals(totals.income, totals.expense);
  return totals;
}

function columnForIncome(
  categories: BudgetCategory[],
  categoryName: string,
  label: string,
  field: BudgetSpreadsheetColumn['field'],
): BudgetSpreadsheetColumn | null {
  const category = categories.find((item) => item.name === categoryName);
  if (!category) return null;

  return {
    id: `income-${categoryName}`,
    label,
    category,
    field,
    noteField: entryFieldForAmount(field),
  };
}

function entryFieldForAmount(field: BudgetSpreadsheetColumn['field']): BudgetEntryField {
  if (field === 'amountUsd') return BUDGET_ENTRY_FIELD.amountUsd;
  if (field === 'amountEur') return BUDGET_ENTRY_FIELD.amountEur;
  return BUDGET_ENTRY_FIELD.amountUah;
}

function calculateMonthTotals(month: BudgetMonth, categories: BudgetCategory[]): BudgetTotals {
  const totals = zeroTotals();

  for (const entry of month.entries) {
    const category = categories.find((item) => item.id === entry.categoryId);
    if (!category) continue;
    const bucket = category.type === 'INCOME' ? totals.income : totals.expense;
    bucket.amountUah += entry.amountUah;
    bucket.amountUsd += entry.amountUsd;
    bucket.amountEur += entry.amountEur;
  }

  totals.balance = subtractCurrencyTotals(totals.income, totals.expense);
  return totals;
}

function zeroTotals(): BudgetTotals {
  return {
    income: { amountUah: 0, amountUsd: 0, amountEur: 0 },
    expense: { amountUah: 0, amountUsd: 0, amountEur: 0 },
    balance: { amountUah: 0, amountUsd: 0, amountEur: 0 },
  };
}

function addCurrencyTotals(target: BudgetCurrencyTotals, source: BudgetCurrencyTotals) {
  target.amountUah += source.amountUah;
  target.amountUsd += source.amountUsd;
  target.amountEur += source.amountEur;
}

function subtractCurrencyTotals(
  income: BudgetCurrencyTotals,
  expense: BudgetCurrencyTotals,
): BudgetCurrencyTotals {
  return {
    amountUah: income.amountUah - expense.amountUah,
    amountUsd: income.amountUsd - expense.amountUsd,
    amountEur: income.amountEur - expense.amountEur,
  };
}

function compareCategories(a: BudgetCategory, b: BudgetCategory): number {
  return (
    BUDGET_GROUPS.indexOf(a.group) - BUDGET_GROUPS.indexOf(b.group) ||
    a.order - b.order ||
    a.name.localeCompare(b.name)
  );
}
