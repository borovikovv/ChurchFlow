import type { CalendarEventItem } from '@churchflow/shared';
import { CALENDAR_REPEAT, CALENDAR_TYPE } from './calendar-constants';
import type { CalendarFormState } from './calendar-types';

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

export function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T12:00`));
}

export function formatMonthLabel(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
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
