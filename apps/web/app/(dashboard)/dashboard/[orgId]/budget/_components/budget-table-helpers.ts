import {
  BUDGET_ENTRY_FIELD,
  BUDGET_GROUPS,
  addCurrencyTotals,
  budgetAmountField,
  calculateBudgetTotals,
  exchangeMovement,
  roundCurrencyTotals,
  roundMoney,
  toBaseEquivalent,
  type BudgetAmountField,
  type BudgetAmountRow,
  type BudgetCategory,
  type BudgetCurrency,
  type BudgetCurrencyTotals,
  type BudgetEntry,
  type BudgetEntryField,
  type BudgetGroup,
  type BudgetMonth,
} from '@churchflow/shared';
import { BUDGET_START_YEAR, BUDGET_YEAR_LOOKAHEAD } from '../constants';

export type BudgetColumnLabels = {
  donations: string;
  eurIncome: string;
  officeRent: string;
  usdIncome: string;
};

export type BudgetGroupLabels = Record<BudgetGroup, string>;

export type BudgetTotalsKey = 'income' | 'expense' | 'balance';

export type BudgetGroupBaseSummary = {
  group: BudgetGroup;
  income: number;
  expense: number;
};

export const BUDGET_CURRENCY_MESSAGE_KEY = {
  UAH: 'currencyUah',
  USD: 'currencyUsd',
  EUR: 'currencyEur',
} as const satisfies Record<BudgetCurrency, string>;

export type BudgetSpreadsheetColumn = {
  id: string;
  label: string;
  category: BudgetCategory;
  field: BudgetAmountField;
  noteField: BudgetEntryField;
  hint?: string;
};

export function formatMoney(value: number, currency: BudgetCurrency, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatAmount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

export function formatTotalsInline(totals: BudgetCurrencyTotals, locale: string): string {
  return [
    formatMoney(totals.amountUah, 'UAH', locale),
    formatMoney(totals.amountUsd, 'USD', locale),
    formatMoney(totals.amountEur, 'EUR', locale),
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

export function spreadsheetColumns(
  categories: BudgetCategory[],
  labels: {
    columns: BudgetColumnLabels;
    groups: BudgetGroupLabels;
    deprecatedExchangeHint: string;
  },
): BudgetSpreadsheetColumn[] {
  const incomeCategories = categories
    .filter((category) => category.type === 'INCOME')
    .sort(compareCategories);
  const expenseCategories = categories
    .filter((category) => category.type === 'EXPENSE')
    .sort(compareCategories);

  return [
    columnForIncome(incomeCategories, 'Office rent income', labels.columns.officeRent, 'amountUah'),
    columnForIncome(
      incomeCategories,
      'Offerings and donations',
      labels.columns.donations,
      'amountUah',
    ),
    columnForIncome(incomeCategories, 'USD income', labels.columns.usdIncome, 'amountUsd'),
    columnForIncome(incomeCategories, 'EUR income', labels.columns.eurIncome, 'amountEur'),
    ...BUDGET_GROUPS.filter((group) => group !== 'INCOME').flatMap((group) => {
      const category = expenseCategories.find((item) => item.group === group);
      if (!category) return [];

      return [
        {
          id: `expense-${group}`,
          label: labels.groups[group],
          category,
          field: 'amountUah' as const,
          noteField: BUDGET_ENTRY_FIELD.amountUah,
          ...(group === 'CURRENCY_EXCHANGE' ? { hint: labels.deprecatedExchangeHint } : {}),
        },
      ];
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
  return {
    ...month,
    totals: calculateBudgetTotals(
      amountRows(month.entries, categories),
      exchangeMovement(month.exchanges),
    ),
  };
}

// Every month is converted at its own rate before the year is added up, so a December total is
// never priced with an August rate.
export function sumMonthsInBase(
  months: BudgetMonth[],
  key: BudgetTotalsKey,
  baseCurrency: BudgetCurrency,
): number | null {
  let total = 0;

  for (const month of months) {
    const amount = toBaseEquivalent(month.totals[key], baseCurrency, month.rates);
    if (amount === null) return null;

    total += amount;
  }

  return roundMoney(total);
}

export function buildGroupBaseSummaries(
  months: BudgetMonth[],
  categories: BudgetCategory[],
  baseCurrency: BudgetCurrency,
): BudgetGroupBaseSummary[] {
  const categoriesByGroup = new Map(
    BUDGET_GROUPS.map((group) => [
      group,
      categories.filter((category) => category.group === group),
    ]),
  );

  return BUDGET_GROUPS.map((group) => {
    const groupCategories = categoriesByGroup.get(group) ?? [];
    let income = 0;
    let expense = 0;

    for (const month of months) {
      const totals = calculateBudgetTotals(amountRows(month.entries, groupCategories));
      income += monthAmountInBase(totals.income, baseCurrency, month);
      expense += monthAmountInBase(totals.expense, baseCurrency, month);
    }

    return { group, income: roundMoney(income), expense: roundMoney(expense) };
  });
}

// Charts draw one bar per period, so an unpriced month falls back to its base currency leg rather
// than dropping the bar entirely.
export function monthAmountInBase(
  totals: BudgetCurrencyTotals,
  baseCurrency: BudgetCurrency,
  month: Pick<BudgetMonth, 'rates'> | undefined,
): number {
  return (
    toBaseEquivalent(totals, baseCurrency, month?.rates ?? null) ??
    totals[budgetAmountField(baseCurrency)]
  );
}

export function carryForwardBalance(
  opening: BudgetCurrencyTotals,
  yearBalance: BudgetCurrencyTotals,
): BudgetCurrencyTotals {
  return roundCurrencyTotals(addCurrencyTotals(opening, yearBalance));
}

function amountRows(entries: BudgetEntry[], categories: BudgetCategory[]): BudgetAmountRow[] {
  const typeByCategoryId = new Map(
    categories.map((category) => [category.id, category.type] as const),
  );

  return entries.flatMap((entry) => {
    const type = typeByCategoryId.get(entry.categoryId);
    if (!type) return [];

    return [
      {
        type,
        amounts: {
          amountUah: entry.amountUah,
          amountUsd: entry.amountUsd,
          amountEur: entry.amountEur,
        },
      },
    ];
  });
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

function compareCategories(a: BudgetCategory, b: BudgetCategory): number {
  return (
    BUDGET_GROUPS.indexOf(a.group) - BUDGET_GROUPS.indexOf(b.group) ||
    a.order - b.order ||
    a.name.localeCompare(b.name)
  );
}
