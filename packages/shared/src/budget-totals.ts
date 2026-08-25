import { budgetAmountField, rateToBase, roundMoney } from './budget-currency.js';
import { BUDGET_CURRENCIES } from './constants.js';
import type {
  BudgetCategoryType,
  BudgetCurrency,
  BudgetCurrencyTotals,
  BudgetExchange,
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
    exchange: zeroCurrencyTotals(),
    balance: zeroCurrencyTotals(),
  };
}

// What the exchanges took out of one currency and put into another, as a signed vector.
export function exchangeMovement(exchanges: BudgetExchange[]): BudgetCurrencyTotals {
  const movement = zeroCurrencyTotals();

  for (const exchange of exchanges) {
    movement[budgetAmountField(exchange.fromCurrency)] -= exchange.fromAmount;
    movement[budgetAmountField(exchange.toCurrency)] += exchange.toAmount;
  }

  return movement;
}

// How much better than the published rate the exchange turned out, in the currency that was
// bought. Positive means more was received than the official rate would have given.
export function exchangeRateGain(exchange: BudgetExchange): number | null {
  if (exchange.officialRate === null) return null;

  return roundMoney(exchange.toAmount - exchange.fromAmount * exchange.officialRate);
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

export function calculateBudgetTotals(
  rows: BudgetAmountRow[],
  exchange: BudgetCurrencyTotals = zeroCurrencyTotals(),
): BudgetTotals {
  let income = zeroCurrencyTotals();
  let expense = zeroCurrencyTotals();

  for (const row of rows) {
    if (row.type === 'INCOME') income = addCurrencyTotals(income, row.amounts);
    else expense = addCurrencyTotals(expense, row.amounts);
  }

  return roundBudgetTotals(income, expense, exchange);
}

export function sumBudgetTotals(items: BudgetTotals[]): BudgetTotals {
  let income = zeroCurrencyTotals();
  let expense = zeroCurrencyTotals();
  let exchange = zeroCurrencyTotals();

  for (const item of items) {
    income = addCurrencyTotals(income, item.income);
    expense = addCurrencyTotals(expense, item.expense);
    exchange = addCurrencyTotals(exchange, item.exchange);
  }

  return roundBudgetTotals(income, expense, exchange);
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
  exchange: BudgetCurrencyTotals,
): BudgetTotals {
  return {
    income: roundCurrencyTotals(income),
    expense: roundCurrencyTotals(expense),
    exchange: roundCurrencyTotals(exchange),
    balance: roundCurrencyTotals(
      addCurrencyTotals(subtractCurrencyTotals(income, expense), exchange),
    ),
  };
}
