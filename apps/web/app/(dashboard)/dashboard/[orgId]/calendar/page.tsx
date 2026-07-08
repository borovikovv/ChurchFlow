import { apiFetch } from '@/api/client';
import {
  DEFAULT_CALENDAR_VISIBLE_EVENT_TYPES,
  type CalendarEventsPayload,
} from '@churchflow/shared';
import {
  confirmCalendarEventImageAction,
  createCalendarEventAction,
  deleteCalendarEventAction,
  enrichCalendarImageUrls,
  loadCalendarEventsAction,
  prepareCalendarEventImageAction,
  toggleCalendarTaskCompletionAction,
  updateCalendarEventAction,
  updateCalendarPreferencesAction,
} from './actions';
import { CalendarManager } from './_components/calendar-manager';

function initialRange(now = new Date()) {
  const rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
  };
}

function dateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default async function CalendarDashboardPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const now = new Date();
  const range = initialRange(now);
  const query = new URLSearchParams({
    rangeStart: range.rangeStart,
    rangeEnd: range.rangeEnd,
  });
  const result = await apiFetch<CalendarEventsPayload>(
    `/organizations/${orgId}/calendar-events?${query}`,
  );
  const payload: CalendarEventsPayload = result.ok
    ? result.data
    : {
        actorRole: null,
        canManage: false,
        events: [],
        preferences: { visibleEventTypes: [...DEFAULT_CALENDAR_VISIBLE_EVENT_TYPES] },
        members: [],
      };
  if (result.ok) {
    await enrichCalendarImageUrls(orgId, payload);
  }

  return (
    <div className="stack">
      <h1>Calendar</h1>
      {!result.ok ? <p className="form-error">{result.error.message}</p> : null}
      <CalendarManager
        organizationId={orgId}
        initialPayload={payload}
        initialRange={range}
        initialSelectedDate={dateInputValue(now)}
        loadEvents={loadCalendarEventsAction}
        updatePreferences={updateCalendarPreferencesAction}
        createEvent={createCalendarEventAction}
        updateEvent={updateCalendarEventAction}
        deleteEvent={deleteCalendarEventAction}
        toggleTaskCompletion={toggleCalendarTaskCompletionAction}
        prepareImage={prepareCalendarEventImageAction}
        confirmImage={confirmCalendarEventImageAction}
      />
    </div>
  );
}
