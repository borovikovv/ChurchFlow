import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatCalendarDate,
  parseCalendarDate,
} from '../apps/web/src/components/forms/calendar-date.ts';

test('calendar dates round-trip without a UTC timezone shift', () => {
  const value = '2026-07-02';
  assert.equal(formatCalendarDate(parseCalendarDate(value)), value);
});

test('nullable calendar values remain nullable', () => {
  assert.equal(parseCalendarDate(null), null);
  assert.equal(formatCalendarDate(null), null);
});
