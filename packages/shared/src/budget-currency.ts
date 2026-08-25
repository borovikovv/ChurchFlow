import type { BudgetAmountField, BudgetCurrency, ExchangeRates } from './types.js';

const AMOUNT_FIELD_BY_CURRENCY: Record<BudgetCurrency, BudgetAmountField> = {
  UAH: 'amountUah',
  USD: 'amountUsd',
  EUR: 'amountEur',
};

export function budgetAmountField(currency: BudgetCurrency): BudgetAmountField {
  return AMOUNT_FIELD_BY_CURRENCY[currency];
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function rateToUah(currency: BudgetCurrency, rates: ExchangeRates | null): number | null {
  if (currency === 'UAH') return 1;
  if (!rates) return null;

  const rate = currency === 'USD' ? rates.usdToUah : rates.eurToUah;
  return rate > 0 ? rate : null;
}

export function rateToBase(
  currency: BudgetCurrency,
  baseCurrency: BudgetCurrency,
  rates: ExchangeRates | null,
): number | null {
  if (currency === baseCurrency) return 1;

  const currencyToUah = rateToUah(currency, rates);
  const baseToUah = rateToUah(baseCurrency, rates);
  if (currencyToUah === null || baseToUah === null) return null;

  return currencyToUah / baseToUah;
}
