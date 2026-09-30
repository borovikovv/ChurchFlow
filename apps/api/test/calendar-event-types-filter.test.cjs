const assert = require('node:assert/strict');
const test = require('node:test');
const { CALENDAR_EVENT_TYPE } = require('@churchflow/shared');
const {
  CalendarEventsService,
} = require('../dist/modules/calendar-events/calendar-events.service');

const ORGANIZATION_ID = 'organization';
const ACTOR_USER_ID = 'actor-user';
const RANGE = {
  rangeStart: '2026-09-01T00:00:00.000Z',
  rangeEnd: '2026-10-01T00:00:00.000Z',
};

function createService(visibleEventTypes, calls) {
  return new CalendarEventsService(
    {
      findActiveMembership: async () => ({ role: 'MEMBER' }),
      getPreferences: async () => ({ visibleEventTypes }),
      listMembers: async () => [],
      listForRange: async (_organizationId, _rangeStart, _rangeEnd, types) => {
        calls.push(types);
        return [];
      },
    },
    {},
  );
}

test('explicitly requested types are listed even when hidden in calendar preferences', async () => {
  const calls = [];
  const service = createService([CALENDAR_EVENT_TYPE.event], calls);

  const payload = await service.listForOrganization(ORGANIZATION_ID, ACTOR_USER_ID, {
    ...RANGE,
    types: [CALENDAR_EVENT_TYPE.service, CALENDAR_EVENT_TYPE.event],
  });

  assert.deepEqual(calls, [[CALENDAR_EVENT_TYPE.service, CALENDAR_EVENT_TYPE.event]]);
  assert.deepEqual(payload.preferences.visibleEventTypes, [CALENDAR_EVENT_TYPE.event]);
});

test('calendar preferences apply when no types are requested', async () => {
  const calls = [];
  const service = createService([CALENDAR_EVENT_TYPE.task], calls);

  await service.listForOrganization(ORGANIZATION_ID, ACTOR_USER_ID, RANGE);

  assert.deepEqual(calls, [[CALENDAR_EVENT_TYPE.task]]);
});

test('an empty type filter lists no event types', async () => {
  const calls = [];
  const service = createService([CALENDAR_EVENT_TYPE.task], calls);

  await service.listForOrganization(ORGANIZATION_ID, ACTOR_USER_ID, { ...RANGE, types: [] });

  assert.deepEqual(calls, [[]]);
});
