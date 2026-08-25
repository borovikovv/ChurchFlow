import { budgetAmountField, rateToBase, roundMoney } from './budget-currency.js';
import { BUDGET_CURRENCIES } from './constants.js';
import type {
  BudgetCategoryType,
  BudgetCurrency,
  BudgetCurrencyTotals,
  BudgetTotals,
  ExchangeRates,
} from './types.js';

export type BudgetAmountRow = {
  type: BudgetCategoryType;
  amounts: BudgetCurrencyTotals;
};

export function zeroCurrencyTotals(): BudgetCurrencyTotals {
  return { amountUah: 0, amountUsd: 0, amountEur: 0 };
}

export function zeroBudgetTotals(): BudgetTotals {
  return {
    income: zeroCurrencyTotals(),
    expense: zeroCurrencyTotals(),
    balance: zeroCurrencyTotals(),
  };
}

export function addCurrencyTotals(
  first: BudgetCurrencyTotals,
  second: BudgetCurrencyTotals,
): BudgetCurrencyTotals {
  return {
    amountUah: first.amountUah + second.amountUah,
    amountUsd: first.amountUsd + second.amountUsd,
    amountEur: first.amountEur + second.amountEur,
  };
}

export function subtractCurrencyTotals(
  first: BudgetCurrencyTotals,
  second: BudgetCurrencyTotals,
): BudgetCurrencyTotals {
  return {
    amountUah: first.amountUah - second.amountUah,
    amountUsd: first.amountUsd - second.amountUsd,
    amountEur: first.amountEur - second.amountEur,
  };
}

export function roundCurrencyTotals(totals: BudgetCurrencyTotals): BudgetCurrencyTotals {
  return {
    amountUah: roundMoney(totals.amountUah),
    amountUsd: roundMoney(totals.amountUsd),
    amountEur: roundMoney(totals.amountEur),
  };
}

export function calculateBudgetTotals(rows: BudgetAmountRow[]): BudgetTotals {
  let income = zeroCurrencyTotals();
  let expense = zeroCurrencyTotals();

  for (const row of rows) {
    if (row.type === 'INCOME') income = addCurrencyTotals(income, row.amounts);
    else expense = addCurrencyTotals(expense, row.amounts);
  }

  return roundBudgetTotals(income, expense);
}

export function sumBudgetTotals(items: BudgetTotals[]): BudgetTotals {
  let income = zeroCurrencyTotals();
  let expense = zeroCurrencyTotals();

  for (const item of items) {
    income = addCurrencyTotals(income, item.income);
    expense = addCurrencyTotals(expense, item.expense);
  }

  return roundBudgetTotals(income, expense);
}

// Returns null when a currency the totals actually hold cannot be priced in the base currency.
export function toBaseEquivalent(
  totals: BudgetCurrencyTotals,
  baseCurrency: BudgetCurrency,
  rates: ExchangeRates | null,
): number | null {
  let total = 0;

  for (const currency of BUDGET_CURRENCIES) {
    const amount = totals[budgetAmountField(currency)];
    if (amount === 0) continue;

    const rate = rateToBase(currency, baseCurrency, rates);
    if (rate === null) return null;

    total += amount * rate;
  }

  return roundMoney(total);
}

function roundBudgetTotals(
  income: BudgetCurrencyTotals,
  expense: BudgetCurrencyTotals,
): BudgetTotals {
  return {
    income: roundCurrencyTotals(income),
    expense: roundCurrencyTotals(expense),
    balance: roundCurrencyTotals(subtractCurrencyTotals(income, expense)),
  };
}
