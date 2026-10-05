import { apiFetch } from '@/api/client';
import { getCurrentUser } from '@/auth/session';
import { getMessages } from '@/i18n/messages';
import {
  DEFAULT_CALENDAR_VISIBLE_EVENT_TYPES,
  type CalendarEventItem,
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
import {
  hasCalendarEventLinkParams,
  occurrenceDate,
  parseCalendarEventLink,
  type CalendarEventLink,
} from './_components/calendar-event-link';

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

async function loadLinkedEvent(
  organizationId: string,
  link: CalendarEventLink,
): Promise<CalendarEventItem | null> {
  const query = link.occurrenceDate
    ? `?${new URLSearchParams({ occurrenceDate: link.occurrenceDate })}`
    : '';
  const result = await apiFetch<CalendarEventItem>(
    `/organizations/${organizationId}/calendar-events/${link.eventId}${query}`,
  );
  if (!result.ok) return null;
  await enrichCalendarImageUrls(organizationId, { events: [result.data], members: [] });

  return result.data;
}

export default async function CalendarDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const pageQuery = await searchParams;
  const eventLinkRequested = hasCalendarEventLinkParams(pageQuery);
  const eventLink = parseCalendarEventLink(pageQuery);
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? 'en');
  const linkedEvent = eventLink ? await loadLinkedEvent(orgId, eventLink) : null;
  const linkedDate = linkedEvent ? occurrenceDate(linkedEvent) : null;
  const now = new Date();
  const range = initialRange(linkedDate ? new Date(`${linkedDate}T12:00:00`) : now);
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
      {eventLinkRequested && !linkedEvent ? (
        <p className="form-error">{messages.calendar.view.notFound}</p>
      ) : null}
      <CalendarManager
        organizationId={orgId}
        initialPayload={payload}
        initialRange={range}
        initialSelectedDate={linkedDate ?? dateInputValue(now)}
        initialViewEvent={linkedEvent}
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
