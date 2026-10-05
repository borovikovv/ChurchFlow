import './support/web-module-hooks.ts';
import assert from 'node:assert/strict';
import test from 'node:test';

const {
  calendarEventLinkHref,
  hasCalendarEventLinkParams,
  occurrenceDate,
  parseCalendarEventLink,
} =
  await import('../apps/web/app/(dashboard)/dashboard/[orgId]/calendar/_components/calendar-event-link.ts');

const EVENT_ID = '3f1a1f3e-0000-4000-8000-000000000001';
const CALENDAR_HREF = 'https://app.example/dashboard/org/calendar';

test('a repeating occurrence links to its series and its day', () => {
  const href = calendarEventLinkHref(CALENDAR_HREF, {
    baseEventId: EVENT_ID,
    repeatPeriod: 'WEEKLY',
    startsAt: '2026-10-11T07:00:00.000Z',
  });

  assert.equal(href, `${CALENDAR_HREF}?event=${EVENT_ID}&on=2026-10-11`);
  assert.deepEqual(parseCalendarEventLink(Object.fromEntries(new URL(href).searchParams)), {
    eventId: EVENT_ID,
    occurrenceDate: '2026-10-11',
  });
});

test('a one-off event links without a day', () => {
  const href = calendarEventLinkHref(CALENDAR_HREF, {
    baseEventId: EVENT_ID,
    repeatPeriod: 'NONE',
    startsAt: '2026-10-11T07:00:00.000Z',
  });

  assert.equal(href, `${CALENDAR_HREF}?event=${EVENT_ID}`);
  assert.deepEqual(parseCalendarEventLink({ event: EVENT_ID }), {
    eventId: EVENT_ID,
    occurrenceDate: null,
  });
});

test('the occurrence day is read in Kyiv, not UTC', () => {
  // An all-day event saved from Kyiv is stored as the previous evening in UTC.
  assert.equal(occurrenceDate({ startsAt: '2026-10-31T22:00:00.000Z' }), '2026-11-01');
  assert.equal(occurrenceDate({ startsAt: '2026-10-10T21:30:00.000Z' }), '2026-10-11');
});

test('removing the link keeps unrelated query parameters', () => {
  const href = calendarEventLinkHref(
    `${CALENDAR_HREF}?notificationId=n1&event=${EVENT_ID}&on=2026-10-11`,
    null,
  );

  assert.equal(href, `${CALENDAR_HREF}?notificationId=n1`);
});

test('a malformed link is still recognised as a link request', () => {
  assert.equal(hasCalendarEventLinkParams({}), false);
  assert.equal(hasCalendarEventLinkParams({ notificationId: 'n1' }), false);
  assert.equal(hasCalendarEventLinkParams({ event: 'not-a-uuid' }), true);
  assert.equal(hasCalendarEventLinkParams({ on: '2026-10-11' }), true);
});

test('malformed links do not parse', () => {
  assert.equal(parseCalendarEventLink({}), null);
  assert.equal(parseCalendarEventLink({ event: 'not-a-uuid' }), null);
  assert.equal(parseCalendarEventLink({ event: [EVENT_ID, EVENT_ID] }), null);
  assert.equal(parseCalendarEventLink({ event: EVENT_ID, on: '2026-13-40' }), null);
});
