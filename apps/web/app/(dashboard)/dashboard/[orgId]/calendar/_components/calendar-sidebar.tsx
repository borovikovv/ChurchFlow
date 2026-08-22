'use client';

import type { CalendarEventItem } from '@churchflow/shared';
import { useLocale, useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { EVENT_TYPE_STYLES } from './calendar-constants';
import { formatDateLabel } from './calendar-date-utils';

export function CalendarSidebar({
  canManage,
  selectedDate,
  selectedDateEvents,
  selectedDateTasks,
  onEventOpen,
  onTaskToggle,
}: {
  canManage: boolean;
  selectedDate: string;
  selectedDateEvents: CalendarEventItem[];
  selectedDateTasks: CalendarEventItem[];
  onEventOpen: (event: CalendarEventItem) => void;
  onTaskToggle: (event: CalendarEventItem, completed: boolean) => void;
}) {
  const t = useTranslations('calendar');
  const locale = useLocale();

  return (
    <aside className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
      <h2>{t('nextUp')}</h2>
      <p className="mb-3 text-sm">{t('selectedDayAgenda')}</p>

      <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs text-[var(--muted)]">
        <span className="h-px bg-[var(--line-muted)]" />
        <span>{formatDateLabel(selectedDate, locale)}</span>
        <span className="h-px bg-[var(--line-muted)]" />
      </div>

      <div className="grid gap-2">
        {selectedDateEvents.slice(0, 5).map((event) => (
          <button
            key={event.occurrenceId}
            className={`min-w-0 rounded-md border-l-4 px-2.5 py-2 text-left text-sm ${EVENT_TYPE_STYLES[event.type]}`}
            type="button"
            onClick={() => onEventOpen(event)}
          >
            <span className="block truncate font-semibold">{event.title}</span>
            <span className="block truncate text-xs">{t(`eventTypes.${event.type}`)}</span>
          </button>
        ))}
        {selectedDateEvents.length === 0 ? (
          <p className="mb-0 text-sm">{t('noEventsForDay')}</p>
        ) : null}
      </div>

      {selectedDateTasks.length > 0 ? (
        <div className="mt-5 border-t border-[var(--line-muted)] pt-4">
          <strong className="text-sm">{t('tasksForDay')}</strong>
          <div className="mt-2 grid gap-1.5">
            {selectedDateTasks.map((event) => (
              <Checkbox
                checked={event.taskCompleted}
                disabled={!canManage}
                key={event.occurrenceId}
                label={event.title}
                labelClassName="rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-1 font-normal hover:border-[var(--accent)] hover:bg-[var(--surface)]"
                textClassName={event.taskCompleted ? 'truncate line-through' : 'truncate'}
                onChange={(changeEvent) => onTaskToggle(event, changeEvent.currentTarget.checked)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
