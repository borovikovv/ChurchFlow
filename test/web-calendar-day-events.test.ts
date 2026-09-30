import './support/web-module-hooks.ts';
import assert from 'node:assert/strict';
import test from 'node:test';

const { eventTypesByDate } =
  await import('../apps/web/app/(dashboard)/dashboard/[orgId]/calendar/_components/calendar-day-events.ts');

type CalendarEvent = Parameters<typeof eventTypesByDate>[0][number];

function calendarEvent(type: CalendarEvent['type'], startsAt: string): CalendarEvent {
  return {
    id: `${type}-${startsAt}`,
    occurrenceId: `${type}-${startsAt}`,
    baseEventId: `${type}-${startsAt}`,
    type,
    title: type,
    description: null,
    startsAt,
    endsAt: null,
    allDay: false,
    reminder: null,
    repeatPeriod: 'NONE',
    taskCompleted: false,
    linkedMember: null,
    assignees: [],
    image: null,
    serviceDetails: null,
  };
}

test('each day lists its event types once, in legend order', () => {
  const typesByDate = eventTypesByDate([
    calendarEvent('SERVICE', '2026-09-20T10:00:00'),
    calendarEvent('EVENT', '2026-09-20T15:00:00'),
    calendarEvent('SERVICE', '2026-09-20T18:00:00'),
    calendarEvent('TASK', '2026-09-20T19:00:00'),
  ]);

  assert.deepEqual(typesByDate.get('2026-09-20'), ['TASK', 'EVENT', 'SERVICE']);
});

test('events are grouped by the local day they start on', () => {
  const typesByDate = eventTypesByDate([
    calendarEvent('BIRTHDAY', '2026-09-01T09:00:00'),
    calendarEvent('EVENT', '2026-09-02T09:00:00'),
  ]);

  assert.deepEqual([...typesByDate.keys()], ['2026-09-01', '2026-09-02']);
  assert.deepEqual(typesByDate.get('2026-09-01'), ['BIRTHDAY']);
});

test('a day without events has no entry', () => {
  assert.equal(eventTypesByDate([]).size, 0);
});
