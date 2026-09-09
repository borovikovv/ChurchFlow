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

function kyivDates(starts) {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return starts.map((start) => formatter.format(start));
}

test('a 29 February anniversary clamps to 28 February and returns on leap years', () => {
  // 2000-02-29T00:00 in Europe/Kyiv.
  const startsAt = new Date('2000-02-28T22:00:00.000Z');
  const yearlyDates = (year) =>
    kyivDates(
      getOccurrenceStarts({
        startsAt,
        repeatPeriod: CALENDAR_EVENT_REPEAT_PERIOD.yearly,
        rangeStart: new Date(`${String(year)}-02-24T00:00:00.000Z`),
        rangeEnd: new Date(`${String(year)}-03-05T00:00:00.000Z`),
        timeZone: 'Europe/Kyiv',
        includeRangeEnd: true,
      }),
    );

  assert.deepEqual(yearlyDates(2027), ['2027-02-28']);
  assert.deepEqual(yearlyDates(2028), ['2028-02-29']);
  assert.deepEqual(yearlyDates(2029), ['2029-02-28']);
});

test('an ordinary yearly date stays on its own day whatever year it was created', () => {
  const startsAt = new Date('1950-08-30T21:00:00.000Z');
  const yearlyDates = (year) =>
    kyivDates(
      getOccurrenceStarts({
        startsAt,
        repeatPeriod: CALENDAR_EVENT_REPEAT_PERIOD.yearly,
        rangeStart: new Date(`${String(year)}-08-25T00:00:00.000Z`),
        rangeEnd: new Date(`${String(year)}-09-05T00:00:00.000Z`),
        timeZone: 'Europe/Kyiv',
        includeRangeEnd: true,
      }),
    );

  assert.deepEqual(yearlyDates(2026), ['2026-08-31']);
  assert.deepEqual(yearlyDates(2031), ['2031-08-31']);
});

test('a monthly event on the 31st clamps to shorter months without drifting', () => {
  const starts = getOccurrenceStarts({
    // 2026-01-31T00:00 in Europe/Kyiv.
    startsAt: new Date('2026-01-30T22:00:00.000Z'),
    repeatPeriod: CALENDAR_EVENT_REPEAT_PERIOD.monthly,
    rangeStart: new Date('2026-01-01T00:00:00.000Z'),
    rangeEnd: new Date('2026-06-30T00:00:00.000Z'),
    timeZone: 'Europe/Kyiv',
    includeRangeEnd: true,
  });

  assert.deepEqual(kyivDates(starts), [
    '2026-01-31',
    '2026-02-28',
    '2026-03-31',
    '2026-04-30',
    '2026-05-31',
    '2026-06-30',
  ]);
});
