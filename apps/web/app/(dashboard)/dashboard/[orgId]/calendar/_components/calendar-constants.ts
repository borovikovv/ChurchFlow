import type { CalendarEventType } from '@churchflow/shared';
import { CALENDAR_EVENT_REPEAT_PERIOD, CALENDAR_EVENT_TYPE } from '@churchflow/shared';

export const CALENDAR_TYPE = CALENDAR_EVENT_TYPE;
export const CALENDAR_REPEAT = CALENDAR_EVENT_REPEAT_PERIOD;

export const CALENDAR_VIEWS = ['month', 'week', 'day'] as const;

export type CalendarView = (typeof CALENDAR_VIEWS)[number];

/** FullCalendar view names for each URL-facing view value. */
export const FULL_CALENDAR_VIEW: Record<CalendarView, string> = {
  month: 'dayGridMonth',
  week: 'timeGridWeek',
  day: 'timeGridDay',
};

export const DEFAULT_CALENDAR_VIEW: CalendarView = 'month';

export const CALENDAR_VIEW_PARAM = 'view';

export function parseCalendarView(value: string | undefined): CalendarView {
  return CALENDAR_VIEWS.find((view) => view === value) ?? DEFAULT_CALENDAR_VIEW;
}

export const EVENT_TYPES: Array<{ value: CalendarEventType }> = [
  { value: CALENDAR_TYPE.task },
  { value: CALENDAR_TYPE.birthday },
  { value: CALENDAR_TYPE.anniversary },
  { value: CALENDAR_TYPE.event },
  { value: CALENDAR_TYPE.service },
];

export const EVENT_TYPE_STYLES: Record<CalendarEventType, string> = {
  BIRTHDAY: 'border-l-emerald-500 bg-emerald-50 text-emerald-900',
  ANNIVERSARY: 'border-l-pink-500 bg-pink-50 text-pink-900',
  TASK: 'border-l-sky-500 bg-sky-50 text-sky-900',
  EVENT: 'border-l-blue-600 bg-blue-50 text-blue-900',
  SERVICE: 'border-l-yellow-500 bg-yellow-50 text-yellow-950',
};

export const EVENT_TYPE_DOT_STYLES: Record<CalendarEventType, string> = {
  BIRTHDAY: 'bg-emerald-500',
  ANNIVERSARY: 'bg-pink-500',
  TASK: 'bg-sky-500',
  EVENT: 'bg-blue-600',
  SERVICE: 'bg-yellow-500',
};

export const TRANSPARENT_IMAGE_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
