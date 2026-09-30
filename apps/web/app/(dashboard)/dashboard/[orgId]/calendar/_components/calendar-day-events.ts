import type { CalendarEventItem, CalendarEventType } from '@churchflow/shared';
import { EVENT_TYPES } from './calendar-constants';
import { toDateInputValue } from './calendar-date-utils';

export function eventTypesByDate(events: CalendarEventItem[]): Map<string, CalendarEventType[]> {
  const typesByDate = new Map<string, Set<CalendarEventType>>();
  for (const event of events) {
    const date = toDateInputValue(new Date(event.startsAt));
    const types = typesByDate.get(date) ?? new Set<CalendarEventType>();
    types.add(event.type);
    typesByDate.set(date, types);
  }

  return new Map(
    [...typesByDate].map(([date, types]) => [
      date,
      EVENT_TYPES.map((type) => type.value).filter((type) => types.has(type)),
    ]),
  );
}
