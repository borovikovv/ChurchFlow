'use client';

import { useTranslations } from 'next-intl';
import { CALENDAR_VIEWS, type CalendarView } from './calendar-constants';

const activeClassName =
  'flex-1 cursor-pointer rounded-[var(--radius)] border-0 bg-[var(--surface)] px-3 py-1.5 text-sm font-semibold text-[var(--accent-strong)] shadow-[var(--shadow)]';

const inactiveClassName =
  'flex-1 cursor-pointer rounded-[var(--radius)] border-0 bg-transparent px-3 py-1.5 text-sm font-semibold text-[var(--muted)] hover:text-[var(--foreground)]';

export function CalendarViewSwitch({
  value,
  onChange,
}: {
  value: CalendarView;
  onChange: (view: CalendarView) => void;
}) {
  const t = useTranslations('calendar');

  return (
    <div className="mb-3 flex gap-1 rounded-[calc(var(--radius)+3px)] border border-[var(--line)] bg-[var(--surface-subtle)] p-1 md:hidden">
      {CALENDAR_VIEWS.map((view) => (
        <button
          aria-pressed={view === value}
          className={view === value ? activeClassName : inactiveClassName}
          key={view}
          onClick={() => onChange(view)}
          type="button"
        >
          {t(`views.${view}`)}
        </button>
      ))}
    </div>
  );
}
