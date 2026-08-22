'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { formatDateLabel, toDateInputValue, weekDays } from './calendar-date-utils';

export function CalendarDayStrip({
  onSelect,
  selectedDate,
}: {
  onSelect: (date: string) => void;
  selectedDate: string;
}) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    [locale],
  );
  const days = useMemo(() => weekDays(new Date(`${selectedDate}T12:00`)), [selectedDate]);
  const today = toDateInputValue(new Date());

  return (
    <div className="mb-3 grid grid-cols-7 gap-1">
      {days.map((day) => {
        const value = toDateInputValue(day);
        const isSelected = value === selectedDate;

        return (
          <button
            aria-pressed={isSelected}
            className="flex cursor-pointer flex-col items-center gap-1 rounded-[var(--radius)] border-0 bg-transparent px-0 py-1.5 hover:bg-[var(--surface-subtle)]"
            key={value}
            onClick={() => onSelect(value)}
            type="button"
          >
            <span className="sr-only">
              {t('selectDay', { date: formatDateLabel(value, locale) })}
            </span>
            <span aria-hidden="true" className="text-xs font-semibold text-[var(--muted)]">
              {weekdayFormatter.format(day)}
            </span>
            <span
              aria-hidden="true"
              className={
                isSelected
                  ? 'grid h-7 w-7 place-items-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white'
                  : value === today
                    ? 'grid h-7 w-7 place-items-center rounded-full bg-[#ddf4ff] text-sm font-semibold text-[var(--foreground)]'
                    : 'grid h-7 w-7 place-items-center rounded-full text-sm font-semibold text-[var(--foreground)]'
              }
            >
              {day.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
