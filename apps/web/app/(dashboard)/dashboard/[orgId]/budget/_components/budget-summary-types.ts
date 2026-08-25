import type {
  BudgetCurrency,
  BudgetCurrencyTotals,
  BudgetTotals,
  ExchangeRates,
} from '@churchflow/shared';

export type BudgetSummaryLabels = {
  closingBalance: string;
  expenses: string;
  income: string;
  openingBalance: string;
};

export type BudgetSummaryData = {
  baseCurrency: BudgetCurrency;
  closingBalance: BudgetCurrencyTotals;
  labels: BudgetSummaryLabels;
  openingBalance: BudgetCurrencyTotals;
  rates: ExchangeRates | null;
  totals: BudgetTotals;
  totalsInBase: { income: number | null; expense: number | null };
};
