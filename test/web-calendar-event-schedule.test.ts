import './support/web-module-hooks.ts';
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.TZ = 'UTC';

const { formatEventSchedule } =
  await import('../apps/web/app/(dashboard)/dashboard/[orgId]/calendar/_components/calendar-date-utils.ts');

test('a timed event shows its day and its time range', () => {
  const schedule = formatEventSchedule(
    { allDay: false, startsAt: '2026-10-11T10:00:00.000Z', endsAt: '2026-10-11T12:00:00.000Z' },
    'en-GB',
  );

  assert.match(schedule.date, /^Sunday,? 11 October 2026$/);
  assert.match(schedule.time ?? '', /^10:00\s*–\s*12:00$/);
});

test('a timed event without an end shows only its start time', () => {
  const schedule = formatEventSchedule(
    { allDay: false, startsAt: '2026-10-11T10:00:00.000Z', endsAt: null },
    'en-GB',
  );

  assert.equal(schedule.time, '10:00');
});

test('an all-day event has no time', () => {
  const schedule = formatEventSchedule(
    { allDay: true, startsAt: '2026-10-11T00:00:00.000Z', endsAt: null },
    'en-GB',
  );

  assert.match(schedule.date, /^Sunday,? 11 October 2026$/);
  assert.equal(schedule.time, null);
});

test('an event spanning days shows one range and no separate time', () => {
  const schedule = formatEventSchedule(
    { allDay: false, startsAt: '2026-10-09T18:00:00.000Z', endsAt: '2026-10-11T12:00:00.000Z' },
    'en-GB',
  );

  assert.match(schedule.date, /9 October 2026.*11 October 2026/);
  assert.equal(schedule.time, null);
});
