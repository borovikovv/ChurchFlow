import type { EventContentArg } from '@fullcalendar/core';
import type { ChangeEvent, KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import type { CalendarEventItem, CalendarEventType } from '@churchflow/shared';
import { CALENDAR_TYPE, EVENT_TYPE_STYLES, FULL_CALENDAR_VIEW } from './calendar-constants';
import { taskCheckboxClassName, type TaskCheckboxPlacement } from './calendar-event-content.styles';

type CalendarEventContentOptions = {
  canManage: boolean;
  markCompleteLabel: string;
  markIncompleteLabel: string;
  typeLabel: (type: CalendarEventType) => string;
  onTaskToggle: (event: CalendarEventItem, completed: boolean) => void;
};

// FullCalendar handles event clicks with a native listener that React's stopPropagation cannot reach.
const TASK_TOGGLE_SELECTOR = '[data-calendar-task-toggle]';

export function isTaskToggleTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TASK_TOGGLE_SELECTOR) !== null;
}

export function renderEventContent(arg: EventContentArg, options: CalendarEventContentOptions) {
  const item = arg.event.extendedProps['item'] as CalendarEventItem | undefined;
  if (!item) return arg.event.title;
  if (arg.view.type === FULL_CALENDAR_VIEW.week) return renderListEventContent(item, options);
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
      {isTask ? (
        <TaskCompletionCheckbox event={item} options={options} placement="overlay" />
      ) : null}
      <span className={titleClassName}>{item.title}</span>
    </div>
  );
}

function renderListEventContent(item: CalendarEventItem, options: CalendarEventContentOptions) {
  const isTask = item.type === CALENDAR_TYPE.task;

  return (
    <div
      className={`flex min-w-0 items-start gap-2 rounded-md border-l-4 px-2.5 py-2 text-sm ${EVENT_TYPE_STYLES[item.type]}`}
    >
      {isTask ? <TaskCompletionCheckbox event={item} options={options} placement="inline" /> : null}
      <span className="min-w-0">
        <span
          className={`block font-semibold break-words ${item.taskCompleted && isTask ? 'line-through' : ''}`}
        >
          {item.title}
        </span>
        <span className="block text-xs">{options.typeLabel(item.type)}</span>
      </span>
    </div>
  );
}

function TaskCompletionCheckbox({
  event,
  options,
  placement,
}: {
  event: CalendarEventItem;
  options: CalendarEventContentOptions;
  placement: TaskCheckboxPlacement;
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
      className={taskCheckboxClassName({ placement, canManage: options.canManage })}
      data-calendar-task-toggle=""
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
