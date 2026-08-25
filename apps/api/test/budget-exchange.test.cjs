const assert = require('node:assert/strict');
const test = require('node:test');
const {
  calculateBudgetTotals,
  exchangeMovement,
  exchangeRateGain,
  sumBudgetTotals,
} = require('@churchflow/shared');

function totals(amountUah, amountUsd, amountEur) {
  return { amountUah, amountUsd, amountEur };
}

function exchange(overrides) {
  return {
    id: 'exchange-1',
    monthId: 'month-1',
    occurredOn: '2026-08-15',
    fromCurrency: 'UAH',
    fromAmount: 41000,
    toCurrency: 'USD',
    toAmount: 1000,
    dealRate: 1000 / 41000,
    officialRate: 1 / 41.23,
    note: null,
    ...overrides,
  };
}

test('an exchange moves money between currencies without touching turnover', () => {
  const result = calculateBudgetTotals(
    [{ type: 'INCOME', amounts: totals(50000, 0, 0) }],
    exchangeMovement([exchange()]),
  );

  assert.deepEqual(result.income, totals(50000, 0, 0));
  assert.deepEqual(result.expense, totals(0, 0, 0));
  assert.deepEqual(result.exchange, totals(-41000, 1000, 0));
  assert.deepEqual(result.balance, totals(9000, 1000, 0));
});

test('exchanges in both directions net out per currency', () => {
  const movement = exchangeMovement([
    exchange(),
    exchange({
      id: 'exchange-2',
      fromCurrency: 'USD',
      fromAmount: 400,
      toCurrency: 'EUR',
      toAmount: 350,
    }),
  ]);

  assert.deepEqual(movement, totals(-41000, 600, 350));
});

test('summing months keeps the exchange leg out of income and expense', () => {
  const january = calculateBudgetTotals(
    [{ type: 'INCOME', amounts: totals(50000, 0, 0) }],
    exchangeMovement([exchange()]),
  );
  const february = calculateBudgetTotals([{ type: 'EXPENSE', amounts: totals(0, 200, 0) }]);
  const year = sumBudgetTotals([january, february]);

  assert.deepEqual(year.income, totals(50000, 0, 0));
  assert.deepEqual(year.expense, totals(0, 200, 0));
  assert.deepEqual(year.exchange, totals(-41000, 1000, 0));
  assert.deepEqual(year.balance, totals(9000, 800, 0));
});

test('the rate gain reports what the official rate would have given instead', () => {
  assert.equal(exchangeRateGain(exchange()), 5.58);
  assert.equal(exchangeRateGain(exchange({ toAmount: 990 })), -4.42);
});

test('the rate gain is unknown when no official rate was published', () => {
  assert.equal(exchangeRateGain(exchange({ officialRate: null })), null);
});
