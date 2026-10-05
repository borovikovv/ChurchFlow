import { z } from 'zod';
import {
  CALENDAR_EVENT_REPEAT_PERIOD,
  CALENDAR_TIME_ZONE,
  type CalendarEventItem,
} from '@churchflow/shared';

export const CALENDAR_EVENT_LINK_PARAMS = { event: 'event', occurrenceDate: 'on' } as const;

const calendarEventLinkSchema = z.object({
  eventId: z.string().uuid(),
  occurrenceDate: z.string().date().nullable(),
});

export type CalendarEventLink = z.infer<typeof calendarEventLinkSchema>;

type SearchParamValue = string | string[] | undefined;

function singleValue(value: SearchParamValue): string | null {
  return typeof value === 'string' ? value : null;
}

export function hasCalendarEventLinkParams(
  searchParams: Record<string, SearchParamValue>,
): boolean {
  return Object.values(CALENDAR_EVENT_LINK_PARAMS).some((name) => searchParams[name] !== undefined);
}

export function parseCalendarEventLink(
  searchParams: Record<string, SearchParamValue>,
): CalendarEventLink | null {
  const eventId = singleValue(searchParams[CALENDAR_EVENT_LINK_PARAMS.event]);
  if (eventId === null) return null;

  const parsed = calendarEventLinkSchema.safeParse({
    eventId,
    occurrenceDate: singleValue(searchParams[CALENDAR_EVENT_LINK_PARAMS.occurrenceDate]),
  });

  return parsed.success ? parsed.data : null;
}

/** The occurrence's day in the zone the API expands repeating events in. */
export function occurrenceDate(event: Pick<CalendarEventItem, 'startsAt'>): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CALENDAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(event.startsAt));
}

/** `href` with the link to `event` set, or with any event link removed when `event` is null. */
export function calendarEventLinkHref(
  href: string,
  event: Pick<CalendarEventItem, 'baseEventId' | 'repeatPeriod' | 'startsAt'> | null,
): string {
  const url = new URL(href);
  url.searchParams.delete(CALENDAR_EVENT_LINK_PARAMS.event);
  url.searchParams.delete(CALENDAR_EVENT_LINK_PARAMS.occurrenceDate);
  if (event) {
    url.searchParams.set(CALENDAR_EVENT_LINK_PARAMS.event, event.baseEventId);
    if (event.repeatPeriod !== CALENDAR_EVENT_REPEAT_PERIOD.none) {
      url.searchParams.set(CALENDAR_EVENT_LINK_PARAMS.occurrenceDate, occurrenceDate(event));
    }
  }

  return url.toString();
}
