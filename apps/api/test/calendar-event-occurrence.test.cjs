const assert = require('node:assert/strict');
const test = require('node:test');
const { NotFoundException } = require('@nestjs/common');
const { CALENDAR_EVENT_REPEAT_PERIOD, CALENDAR_EVENT_TYPE } = require('@churchflow/shared');
const {
  CalendarEventsService,
} = require('../dist/modules/calendar-events/calendar-events.service');

const ORGANIZATION_ID = 'organization';
const EVENT_ID = '3f1a1f3e-0000-4000-8000-000000000001';

function serviceEvent(overrides = {}) {
  return {
    id: EVENT_ID,
    organizationId: ORGANIZATION_ID,
    type: CALENDAR_EVENT_TYPE.service,
    title: 'Sunday service',
    description: null,
    // 10:00 in Kyiv on Sunday 2026-09-06.
    startsAt: new Date('2026-09-06T07:00:00.000Z'),
    endsAt: new Date('2026-09-06T09:00:00.000Z'),
    allDay: false,
    reminder: null,
    repeatPeriod: CALENDAR_EVENT_REPEAT_PERIOD.weekly,
    taskCompleted: false,
    createdByUserId: 'creator-user',
    linkedMembershipId: null,
    linkedMembership: null,
    assignees: [],
    serviceDetails: null,
    imageAsset: null,
    ...overrides,
  };
}

function createService(event, calls = []) {
  return new CalendarEventsService(
    {
      findById: async (organizationId, eventId) => {
        calls.push({ organizationId, eventId });
        return event;
      },
    },
    {},
  );
}

test('returns the occurrence of a repeating event on the requested Kyiv day', async () => {
  const service = createService(serviceEvent());

  const item = await service.findOccurrence(ORGANIZATION_ID, EVENT_ID, {
    occurrenceDate: '2026-10-11',
  });

  // Kyiv leaves summer time on 2026-10-25, so this one still starts at 07:00 UTC.
  assert.equal(item.startsAt, '2026-10-11T07:00:00.000Z');
  assert.equal(item.endsAt, '2026-10-11T09:00:00.000Z');
  assert.equal(item.occurrenceId, `${EVENT_ID}:2026-10-11T07:00:00.000Z`);
  assert.equal(item.baseEventId, EVENT_ID);
});

test('reads the requested day in Kyiv, not UTC', async () => {
  // 00:30 in Kyiv is still the previous day in UTC.
  const service = createService(
    serviceEvent({
      startsAt: new Date('2026-09-05T21:30:00.000Z'),
      endsAt: null,
    }),
  );

  const item = await service.findOccurrence(ORGANIZATION_ID, EVENT_ID, {
    occurrenceDate: '2026-10-11',
  });

  assert.equal(item.startsAt, '2026-10-10T21:30:00.000Z');
});

test('a day without an occurrence is not found', async () => {
  const service = createService(serviceEvent());

  await assert.rejects(
    service.findOccurrence(ORGANIZATION_ID, EVENT_ID, { occurrenceDate: '2026-10-12' }),
    NotFoundException,
  );
});

test('without a date the series itself is returned', async () => {
  const service = createService(serviceEvent());

  const item = await service.findOccurrence(ORGANIZATION_ID, EVENT_ID, {});

  assert.equal(item.startsAt, '2026-09-06T07:00:00.000Z');
  assert.equal(item.occurrenceId, EVENT_ID);
});

test('a one-off event ignores the requested date', async () => {
  const service = createService(serviceEvent({ repeatPeriod: CALENDAR_EVENT_REPEAT_PERIOD.none }));

  const item = await service.findOccurrence(ORGANIZATION_ID, EVENT_ID, {
    occurrenceDate: '2026-10-11',
  });

  assert.equal(item.startsAt, '2026-09-06T07:00:00.000Z');
});

test('an event missing from the organization is not found', async () => {
  const calls = [];
  const service = createService(null, calls);

  await assert.rejects(
    service.findOccurrence(ORGANIZATION_ID, EVENT_ID, { occurrenceDate: '2026-10-11' }),
    NotFoundException,
  );
  assert.deepEqual(calls, [{ organizationId: ORGANIZATION_ID, eventId: EVENT_ID }]);
});
