import type { EventContentArg } from '@fullcalendar/core';
import type { ChangeEvent, KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import type { CalendarEventItem } from '@churchflow/shared';
import { CALENDAR_TYPE, EVENT_TYPE_STYLES } from './calendar-constants';

type CalendarEventContentOptions = {
  canManage: boolean;
  markCompleteLabel: string;
  markIncompleteLabel: string;
  onTaskToggle: (event: CalendarEventItem, completed: boolean) => void;
};

export function renderEventContent(arg: EventContentArg, options: CalendarEventContentOptions) {
  const item = arg.event.extendedProps['item'] as CalendarEventItem | undefined;
  if (!item) return arg.event.title;
  const isTask = item.type === CALENDAR_TYPE.task;
  const titleClassName = [
    'block min-w-0 truncate transition-[padding]',
    isTask ? 'group-hover:pl-4.5 group-focus-within:pl-4' : '',
    item.taskCompleted && isTask ? 'line-through' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={`group relative min-w-0 rounded border-l-4 px-1.5 py-0.75 text-[12px] leading-tight ${EVENT_TYPE_STYLES[item.type]}`}
    >
      {isTask ? <TaskCompletionCheckbox event={item} options={options} /> : null}
      <span className={titleClassName}>{item.title}</span>
    </div>
  );
}

function TaskCompletionCheckbox({
  event,
  options,
}: {
  event: CalendarEventItem;
  options: CalendarEventContentOptions;
}) {
  function stopEventPropagation(
    interactionEvent:
      | ChangeEvent<HTMLInputElement>
      | KeyboardEvent<HTMLInputElement>
      | MouseEvent<HTMLLabelElement>
      | PointerEvent<HTMLLabelElement>,
  ) {
    interactionEvent.stopPropagation();
  }

  function handleChange(changeEvent: ChangeEvent<HTMLInputElement>) {
    stopEventPropagation(changeEvent);
    options.onTaskToggle(event, changeEvent.currentTarget.checked);
  }

  return (
    <label
      className={`absolute left-1.5 top-1/2 grid h-4 w-4 -translate-y-1/2 place-items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${options.canManage ? 'cursor-pointer' : 'cursor-not-allowed'}`}
      onClick={stopEventPropagation}
      onPointerDown={stopEventPropagation}
    >
      <input
        aria-label={`${event.taskCompleted ? options.markIncompleteLabel : options.markCompleteLabel}: ${event.title}`}
        checked={event.taskCompleted}
        className="peer sr-only"
        disabled={!options.canManage}
        type="checkbox"
        onChange={handleChange}
        onKeyDown={stopEventPropagation}
      />
      <span className="grid h-3.5 w-3.5 place-items-center rounded border border-(--line) bg-(--surface) text-(--surface) transition-colors peer-checked:border-(--accent-strong) peer-checked:bg-(--accent-strong) peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-[var(--accent)] peer-disabled:opacity-60 peer-checked:[&_svg]:opacity-100">
        <svg
          aria-hidden="true"
          className="h-2.5 w-2.5 opacity-0 transition-opacity"
          fill="none"
          viewBox="0 0 16 16"
        >
          <path
            d="M3.5 8.2 6.6 11 12.5 5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.2"
          />
        </svg>
      </span>
    </label>
  );
}
