const assert = require('node:assert/strict');
const test = require('node:test');
const {
  calculateBudgetTotals,
  rateToBase,
  sumBudgetTotals,
  toBaseEquivalent,
} = require('@churchflow/shared');

const RATES = { date: '2026-08-25', usdToUah: 41.5, eurToUah: 48.2 };

function totals(amountUah, amountUsd, amountEur) {
  return { amountUah, amountUsd, amountEur };
}

test('a currency is always worth one unit of itself', () => {
  assert.equal(rateToBase('USD', 'USD', null), 1);
  assert.equal(rateToBase('UAH', 'UAH', null), 1);
});

test('cross rates are routed through the hryvnia', () => {
  assert.equal(rateToBase('USD', 'UAH', RATES), 41.5);
  assert.equal(rateToBase('UAH', 'USD', RATES), 1 / 41.5);
  assert.equal(rateToBase('EUR', 'USD', RATES), 48.2 / 41.5);
});

test('cross rates are unknown without published rates', () => {
  assert.equal(rateToBase('USD', 'UAH', null), null);
  assert.equal(rateToBase('EUR', 'USD', null), null);
});

test('totals convert into the selected base currency', () => {
  assert.equal(toBaseEquivalent(totals(1000, 100, 50), 'UAH', RATES), 1000 + 4150 + 2410);
  assert.equal(toBaseEquivalent(totals(4150, 0, 0), 'USD', RATES), 100);
});

test('totals holding only the base currency need no rates', () => {
  assert.equal(toBaseEquivalent(totals(1000, 0, 0), 'UAH', null), 1000);
});

test('totals holding an unpriced currency cannot be converted', () => {
  assert.equal(toBaseEquivalent(totals(1000, 100, 0), 'UAH', null), null);
});

test('income and expense rows collapse into a per currency balance', () => {
  const result = calculateBudgetTotals([
    { type: 'INCOME', amounts: totals(1000, 200, 0) },
    { type: 'INCOME', amounts: totals(500, 0, 30) },
    { type: 'EXPENSE', amounts: totals(300, 50, 0) },
  ]);

  assert.deepEqual(result.income, totals(1500, 200, 30));
  assert.deepEqual(result.expense, totals(300, 50, 0));
  assert.deepEqual(result.balance, totals(1200, 150, 30));
});

test('summing totals keeps the balance derived from income and expense', () => {
  const first = calculateBudgetTotals([{ type: 'INCOME', amounts: totals(100.1, 0, 0) }]);
  const second = calculateBudgetTotals([{ type: 'EXPENSE', amounts: totals(0.2, 0, 0) }]);

  assert.deepEqual(sumBudgetTotals([first, second]).balance, totals(99.9, 0, 0));
});
