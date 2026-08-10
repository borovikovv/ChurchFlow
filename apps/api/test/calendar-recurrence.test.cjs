const assert = require('node:assert/strict');
const test = require('node:test');
const { CALENDAR_EVENT_REPEAT_PERIOD } = require('@churchflow/shared');
const {
  expandCalendarEventOccurrences,
  getOccurrenceStarts,
  zonedDateParts,
} = require('../dist/modules/calendar-events/recurrence/calendar-recurrence');

test('expands recurring events whose base start is before the requested range', () => {
  const occurrences = expandCalendarEventOccurrences({
    event: {
      startsAt: new Date('2026-01-04T08:00:00.000Z'),
      endsAt: new Date('2026-01-04T09:30:00.000Z'),
      repeatPeriod: CALENDAR_EVENT_REPEAT_PERIOD.weekly,
    },
    rangeStart: new Date('2026-03-01T00:00:00.000Z'),
    rangeEnd: new Date('2026-03-08T00:00:00.000Z'),
    timeZone: 'Europe/Kyiv',
  });

  assert.deepEqual(
    occurrences.map((occurrence) => ({
      startsAt: occurrence.startsAt.toISOString(),
      endsAt: occurrence.endsAt?.toISOString(),
    })),
    [{ startsAt: '2026-03-01T08:00:00.000Z', endsAt: '2026-03-01T09:30:00.000Z' }],
  );
});

test('preserves local weekly wall time in Europe/Kyiv across daylight saving changes', () => {
  const occurrences = expandCalendarEventOccurrences({
    event: {
      startsAt: new Date('2024-03-24T08:00:00.000Z'),
      endsAt: null,
      repeatPeriod: CALENDAR_EVENT_REPEAT_PERIOD.weekly,
    },
    rangeStart: new Date('2024-03-24T00:00:00.000Z'),
    rangeEnd: new Date('2024-04-08T00:00:00.000Z'),
    timeZone: 'Europe/Kyiv',
  });

  assert.deepEqual(
    occurrences.map((occurrence) => {
      const parts = zonedDateParts(occurrence.startsAt, 'Europe/Kyiv');
      return {
        day: parts.day,
        hour: parts.hour,
        minute: parts.minute,
        startsAt: occurrence.startsAt.toISOString(),
      };
    }),
    [
      { day: 24, hour: 10, minute: 0, startsAt: '2024-03-24T08:00:00.000Z' },
      { day: 31, hour: 10, minute: 0, startsAt: '2024-03-31T07:00:00.000Z' },
      { day: 7, hour: 10, minute: 0, startsAt: '2024-04-07T07:00:00.000Z' },
    ],
  );
});

test('returns one non-recurring occurrence only when it overlaps the requested range', () => {
  const overlapping = expandCalendarEventOccurrences({
    event: {
      startsAt: new Date('2026-03-01T23:00:00.000Z'),
      endsAt: new Date('2026-03-02T01:00:00.000Z'),
      repeatPeriod: CALENDAR_EVENT_REPEAT_PERIOD.none,
    },
    rangeStart: new Date('2026-03-02T00:00:00.000Z'),
    rangeEnd: new Date('2026-03-03T00:00:00.000Z'),
  });
  const outside = expandCalendarEventOccurrences({
    event: {
      startsAt: new Date('2026-03-01T23:00:00.000Z'),
      endsAt: new Date('2026-03-01T23:30:00.000Z'),
      repeatPeriod: CALENDAR_EVENT_REPEAT_PERIOD.none,
    },
    rangeStart: new Date('2026-03-02T00:00:00.000Z'),
    rangeEnd: new Date('2026-03-03T00:00:00.000Z'),
  });

  assert.equal(overlapping.length, 1);
  assert.deepEqual(outside, []);
});

test('occurrence starts exclude the previous recurrence before the range', () => {
  const starts = getOccurrenceStarts({
    startsAt: new Date('2026-01-04T08:00:00.000Z'),
    repeatPeriod: CALENDAR_EVENT_REPEAT_PERIOD.weekly,
    rangeStart: new Date('2026-03-02T00:00:00.000Z'),
    rangeEnd: new Date('2026-03-09T00:00:00.000Z'),
    timeZone: 'Europe/Kyiv',
  });

  assert.deepEqual(
    starts.map((start) => start.toISOString()),
    ['2026-03-08T08:00:00.000Z'],
  );
});
