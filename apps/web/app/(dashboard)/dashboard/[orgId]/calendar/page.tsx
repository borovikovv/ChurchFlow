import { apiFetch } from '@/api/client';
import { getCurrentUser } from '@/auth/session';
import { getMessages } from '@/i18n/messages';
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
import { CALENDAR_VIEW_PARAM, parseCalendarView } from './_components/calendar-constants';
import { calendarViewRange } from './_components/calendar-date-utils';

function dateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default async function CalendarDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const resolvedSearchParams = await searchParams;
  const viewParam = resolvedSearchParams[CALENDAR_VIEW_PARAM];
  const view = parseCalendarView(typeof viewParam === 'string' ? viewParam : undefined);
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? 'en');
  const now = new Date();
  const range = calendarViewRange(view, now);
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
      <h1>{messages.calendar.title}</h1>
      {!result.ok ? <p className="form-error">{result.error.message}</p> : null}
      <CalendarManager
        organizationId={orgId}
        initialPayload={payload}
        initialRange={range}
        initialSelectedDate={dateInputValue(now)}
        initialView={view}
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
