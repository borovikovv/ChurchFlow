import type {
  CalendarEventReminder,
  CalendarEventRepeatPeriod,
  CalendarEventType,
} from '@churchflow/shared';
import {
  CALENDAR_EVENT_REPEAT_PERIOD,
  CALENDAR_EVENT_REPEAT_PERIODS,
  CALENDAR_EVENT_TYPE,
  CALENDAR_EVENT_TYPES,
} from '@churchflow/shared';

export const CALENDAR_TYPE = CALENDAR_EVENT_TYPE;
export const CALENDAR_REPEAT = CALENDAR_EVENT_REPEAT_PERIOD;

export const EVENT_TYPES: Array<{ value: CalendarEventType; label: string }> = [
  { value: CALENDAR_TYPE.task, label: 'Tasks' },
  { value: CALENDAR_TYPE.birthday, label: 'Birthdays' },
  { value: CALENDAR_TYPE.anniversary, label: 'Anniversaries' },
  { value: CALENDAR_TYPE.event, label: 'Events' },
];

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  BIRTHDAY: 'Birthday',
  ANNIVERSARY: 'Anniversary',
  TASK: 'Task',
  EVENT: 'Event',
};

export const EVENT_TYPE_OPTIONS = CALENDAR_EVENT_TYPES.map((value) => ({
  value,
  label: EVENT_TYPE_LABELS[value],
}));

export const REMINDER_OPTIONS: Array<{ value: '' | CalendarEventReminder; label: string }> = [
  { value: '', label: 'No reminder' },
  { value: 'ONE_HOUR', label: '1 hour before' },
  { value: 'ONE_DAY', label: '1 day before' },
  { value: 'ONE_WEEK', label: '1 week before' },
];

export const REPEAT_PERIOD_LABELS: Record<CalendarEventRepeatPeriod, string> = {
  NONE: 'None',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

export const REPEAT_PERIOD_OPTIONS = CALENDAR_EVENT_REPEAT_PERIODS.map((value) => ({
  value,
  label: REPEAT_PERIOD_LABELS[value],
}));

export const EVENT_TYPE_STYLES: Record<CalendarEventType, string> = {
  BIRTHDAY: 'border-l-emerald-500 bg-emerald-50 text-emerald-900',
  ANNIVERSARY: 'border-l-pink-500 bg-pink-50 text-pink-900',
  TASK: 'border-l-sky-500 bg-sky-50 text-sky-900',
  EVENT: 'border-l-blue-600 bg-blue-50 text-blue-900',
};

export const EVENT_TYPE_DOT_STYLES: Record<CalendarEventType, string> = {
  BIRTHDAY: 'bg-emerald-500',
  ANNIVERSARY: 'bg-pink-500',
  TASK: 'bg-sky-500',
  EVENT: 'bg-blue-600',
};

export const TRANSPARENT_IMAGE_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
