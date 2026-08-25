const assert = require('node:assert/strict');
const test = require('node:test');
const { monthRateDate } = require('../dist/modules/currency-rates/currency-rates.service');

function isoDate(value) {
  return value.toISOString().slice(0, 10);
}

test('a closed month is priced on its last day', () => {
  assert.equal(isoDate(monthRateDate(2026, 2, new Date('2026-08-25T09:00:00Z'))), '2026-02-28');
  assert.equal(isoDate(monthRateDate(2024, 2, new Date('2026-08-25T09:00:00Z'))), '2024-02-29');
  assert.equal(isoDate(monthRateDate(2026, 12, new Date('2027-01-05T09:00:00Z'))), '2026-12-31');
});

test('the open month is priced today, not on a date that has not happened', () => {
  assert.equal(isoDate(monthRateDate(2026, 8, new Date('2026-08-25T09:00:00Z'))), '2026-08-25');
});

test('a future month is priced today', () => {
  assert.equal(isoDate(monthRateDate(2027, 3, new Date('2026-08-25T09:00:00Z'))), '2026-08-25');
});
