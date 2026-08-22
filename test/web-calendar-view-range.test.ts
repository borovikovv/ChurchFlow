import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calendarViewRange,
  startOfWeek,
  toDateInputValue,
  weekDays,
} from '../apps/web/app/(dashboard)/dashboard/[orgId]/calendar/_components/calendar-date-utils.ts';

function localDate(value: string): Date {
  return new Date(`${value}T12:00`);
}

test('startOfWeek snaps to Monday', () => {
  assert.equal(toDateInputValue(startOfWeek(localDate('2026-03-09'))), '2026-03-09');
  assert.equal(toDateInputValue(startOfWeek(localDate('2026-03-11'))), '2026-03-09');
  assert.equal(toDateInputValue(startOfWeek(localDate('2026-03-15'))), '2026-03-09');
});

test('weekDays returns Monday through Sunday', () => {
  const days = weekDays(localDate('2026-03-11')).map(toDateInputValue);
  assert.deepEqual(days, [
    '2026-03-09',
    '2026-03-10',
    '2026-03-11',
    '2026-03-12',
    '2026-03-13',
    '2026-03-14',
    '2026-03-15',
  ]);
});

test('calendarViewRange spans the period each view shows', () => {
  const reference = localDate('2026-03-11');

  const day = calendarViewRange('day', reference);
  assert.equal(toDateInputValue(new Date(day.rangeStart)), '2026-03-11');
  assert.equal(toDateInputValue(new Date(day.rangeEnd)), '2026-03-12');

  const week = calendarViewRange('week', reference);
  assert.equal(toDateInputValue(new Date(week.rangeStart)), '2026-03-09');
  assert.equal(toDateInputValue(new Date(week.rangeEnd)), '2026-03-16');

  const month = calendarViewRange('month', reference);
  assert.equal(toDateInputValue(new Date(month.rangeStart)), '2026-03-01');
  assert.equal(toDateInputValue(new Date(month.rangeEnd)), '2026-04-01');
});

test('calendarViewRange handles a month boundary without drifting', () => {
  const week = calendarViewRange('week', localDate('2026-03-01'));
  assert.equal(toDateInputValue(new Date(week.rangeStart)), '2026-02-23');
  assert.equal(toDateInputValue(new Date(week.rangeEnd)), '2026-03-02');
});
