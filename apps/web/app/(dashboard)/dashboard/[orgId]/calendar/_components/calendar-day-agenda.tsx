'use client';

import type { CalendarEventItem } from '@churchflow/shared';
import { useLocale, useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { CALENDAR_TYPE, EVENT_TYPE_STYLES } from './calendar-constants';
import { formatAgendaDateLabel, formatTimeLabel } from './calendar-date-utils';

export function CalendarDayAgenda({
  canManage,
  selectedDate,
  selectedDateEvents,
  onEventOpen,
  onTaskToggle,
}: {
  canManage: boolean;
  selectedDate: string;
  selectedDateEvents: CalendarEventItem[];
  onEventOpen: (event: CalendarEventItem) => void;
  onTaskToggle: (event: CalendarEventItem, completed: boolean) => void;
}) {
  const t = useTranslations('calendar');
  const locale = useLocale();

  return (
    <section className="mt-4 border-t border-[var(--line-muted)] pt-4 md:hidden">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="mb-0 text-lg first-letter:uppercase">
          {formatAgendaDateLabel(selectedDate, locale)}
        </h2>
        <span className="shrink-0 text-sm text-[var(--muted)]">
          {t('eventsCount', { count: selectedDateEvents.length })}
        </span>
      </header>

      {selectedDateEvents.length === 0 ? (
        <p className="mb-0 text-sm text-[var(--muted)]">{t('noEventsForDay')}</p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {selectedDateEvents.map((event) => (
            <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2" key={event.occurrenceId}>
              <span className="pt-2 text-sm leading-tight font-semibold text-[var(--muted)]">
                {event.allDay ? t('fullDay') : formatTimeLabel(event.startsAt, locale)}
                {!event.allDay && event.endsAt ? (
                  <span className="block font-normal">{formatTimeLabel(event.endsAt, locale)}</span>
                ) : null}
              </span>
              <div
                className={`min-w-0 rounded-md border-l-4 text-sm ${EVENT_TYPE_STYLES[event.type]}`}
              >
                <button
                  className="block min-h-11 w-full min-w-0 cursor-pointer border-0 bg-transparent px-2.5 py-2 text-left text-inherit"
                  type="button"
                  onClick={() => onEventOpen(event)}
                >
                  <span
                    className={`block font-semibold break-words ${event.type === CALENDAR_TYPE.task && event.taskCompleted ? 'line-through' : ''}`}
                  >
                    {event.title}
                  </span>
                  <span className="block text-xs">{t(`eventTypes.${event.type}`)}</span>
                </button>
                {event.type === CALENDAR_TYPE.task ? (
                  <Checkbox
                    aria-label={`${event.taskCompleted ? t('markIncomplete') : t('markComplete')}: ${event.title}`}
                    checked={event.taskCompleted}
                    disabled={!canManage}
                    label={t('completed')}
                    labelClassName="min-h-11 px-2.5 pb-1 font-normal"
                    onChange={(changeEvent) =>
                      onTaskToggle(event, changeEvent.currentTarget.checked)
                    }
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
