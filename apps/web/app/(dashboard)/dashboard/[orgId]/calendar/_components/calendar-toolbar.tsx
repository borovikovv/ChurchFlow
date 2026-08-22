'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { CALENDAR_VIEWS, type CalendarView } from './calendar-constants';

export function CalendarToolbar({
  actions,
  onNext,
  onPrev,
  onToday,
  onViewChange,
  title,
  view,
}: {
  actions: ReactNode;
  onNext: () => void;
  onPrev: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
  title: string;
  view: CalendarView;
}) {
  const t = useTranslations('calendar');

  return (
    <div className="mb-3 grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>
        <div
          aria-label={t('viewLabel')}
          className="flex shrink-0 overflow-hidden rounded-[var(--radius)] border border-[var(--line)]"
          role="group"
        >
          {CALENDAR_VIEWS.map((item) => (
            <button
              aria-pressed={item === view}
              className={
                item === view
                  ? 'cursor-pointer border-0 bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white'
                  : 'cursor-pointer border-0 bg-[var(--surface)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-subtle)]'
              }
              key={item}
              onClick={() => onViewChange(item)}
              type="button"
            >
              {t(`views.${item}`)}
            </button>
          ))}
        </div>
      </div>
      <div
        aria-label={t('calendarNavigation')}
        className="flex items-center justify-between gap-2"
        role="group"
      >
        <NavButton label={t('previousPeriod')} onClick={onPrev}>
          ‹
        </NavButton>
        <strong className="min-w-0 truncate text-center text-[17px]">{title}</strong>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="cursor-pointer rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[#eef1f4]"
            onClick={onToday}
            type="button"
          >
            {t('today')}
          </button>
          <NavButton label={t('nextPeriod')} onClick={onNext}>
            ›
          </NavButton>
        </div>
      </div>
    </div>
  );
}

function NavButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-subtle)] text-lg leading-none text-[var(--foreground)] hover:bg-[#eef1f4]"
      onClick={onClick}
      type="button"
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
