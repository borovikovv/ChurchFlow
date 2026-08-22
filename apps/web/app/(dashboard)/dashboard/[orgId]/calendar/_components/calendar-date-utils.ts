import type { CalendarEventItem } from '@churchflow/shared';
import { CALENDAR_REPEAT, CALENDAR_TYPE, type CalendarView } from './calendar-constants';
import type { CalendarFormState, CalendarServiceFormPerson } from './calendar-types';

export function newEventForm(date: string): CalendarFormState {
  return {
    type: CALENDAR_TYPE.event,
    title: '',
    description: '',
    startDate: date,
    startTime: '09:00',
    endDate: '',
    endTime: '',
    allDay: false,
    reminder: '',
    repeatPeriod: CALENDAR_REPEAT.none,
    linkedMembershipId: '',
    imageAssetId: '',
    imageUrl: null,
    assigneeMembershipIds: [],
    taskCompleted: false,
    serviceDetails: emptyServiceDetails(),
  };
}

export function eventForm(event: CalendarEventItem): CalendarFormState {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;

  return {
    type: event.type,
    title: event.title,
    description: event.description ?? '',
    startDate: toDateInputValue(start),
    startTime: toTimeInputValue(start),
    endDate: end ? toDateInputValue(end) : '',
    endTime: end ? toTimeInputValue(end) : '',
    allDay: event.allDay,
    reminder: event.reminder ?? '',
    repeatPeriod: event.repeatPeriod,
    linkedMembershipId: event.linkedMember?.id ?? '',
    imageAssetId: event.image?.id ?? '',
    imageUrl: event.image?.url ?? null,
    assigneeMembershipIds: event.assignees.map((assignee) => assignee.id),
    taskCompleted: event.taskCompleted,
    serviceDetails: {
      preacher: servicePersonForm(event.serviceDetails?.preacher ?? null),
      serviceHost: servicePersonForm(event.serviceDetails?.serviceHost ?? null),
      worshipLead: servicePersonForm(event.serviceDetails?.worshipLead ?? null),
      hasCommunion: event.serviceDetails?.hasCommunion ?? false,
      communionLead: servicePersonForm(event.serviceDetails?.communionLead ?? null),
      biblePassage: event.serviceDetails?.biblePassage ?? '',
      songs: event.serviceDetails?.songs.join('\n') ?? '',
    },
  };
}

export function emptyServiceDetails(): CalendarFormState['serviceDetails'] {
  return {
    preacher: emptyServicePerson(),
    serviceHost: emptyServicePerson(),
    worshipLead: emptyServicePerson(),
    hasCommunion: false,
    communionLead: emptyServicePerson(),
    biblePassage: '',
    songs: '',
  };
}

function emptyServicePerson(): CalendarServiceFormPerson {
  return { membershipId: '', customName: '' };
}

function servicePersonForm(
  person: NonNullable<CalendarEventItem['serviceDetails']>['preacher'] | null,
): CalendarServiceFormPerson {
  return {
    membershipId: person?.membershipId ?? '',
    customName: person?.customName ?? '',
  };
}

export function combineLocalDateTime(date: string, time: string): string {
  return new Date(`${date}T${time || '00:00'}`).toISOString();
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatDateLabel(value: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T12:00`));
}

export function formatMonthLabel(value: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

/** Monday-based, matching FullCalendar's `firstDay={1}`. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekday);
  return start;
}

export function calendarViewRange(
  view: CalendarView,
  reference: Date,
): { rangeStart: string; rangeEnd: string } {
  const start =
    view === 'month'
      ? new Date(reference.getFullYear(), reference.getMonth(), 1)
      : view === 'week'
        ? startOfWeek(reference)
        : new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const end = new Date(start);
  if (view === 'month') end.setMonth(end.getMonth() + 1);
  else if (view === 'week') end.setDate(end.getDate() + 7);
  else end.setDate(end.getDate() + 1);

  return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
}

export function weekDays(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    return day;
  });
}

export function daysInRange(rangeStart: string, rangeEnd: string): Date[] {
  const days: Date[] = [];
  const current = new Date(rangeStart);
  const end = new Date(rangeEnd);
  while (current < end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export function eventImageUrl(event: CalendarEventItem): string | null {
  return event.image?.url ?? event.linkedMember?.photoUrl ?? event.assignees[0]?.photoUrl ?? null;
}
