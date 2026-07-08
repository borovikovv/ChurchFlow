import type { EventContentArg } from '@fullcalendar/core';
import type { CalendarEventItem } from '@churchflow/shared';
import { CALENDAR_TYPE, EVENT_TYPE_STYLES } from './calendar-constants';

export function renderEventContent(arg: EventContentArg) {
  const item = arg.event.extendedProps['item'] as CalendarEventItem | undefined;
  if (!item) return arg.event.title;

  return (
    <div
      className={`min-w-0 rounded border-l-4 px-1.5 py-[3px] text-[12px] leading-tight ${EVENT_TYPE_STYLES[item.type]}`}
    >
      <span className="block truncate">{item.title}</span>
      {item.type === CALENDAR_TYPE.task ? (
        <span className="block truncate text-[11px]">
          {item.taskCompleted ? 'Done' : 'Open task'}
        </span>
      ) : null}
    </div>
  );
}
