'use client';

import type { RefObject } from 'react';
import type { CalendarEventItem } from '@churchflow/shared';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { eventImageUrl, formatMonthLabel, toDateInputValue } from './calendar-date-utils';

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function CalendarPreviewModal({
  events,
  locale,
  printableRef,
  range,
  onClose,
  onDownload,
}: {
  events: CalendarEventItem[];
  locale: string;
  printableRef: RefObject<HTMLDivElement | null>;
  range: { rangeStart: string; rangeEnd: string };
  onClose: () => void;
  onDownload: () => void;
}) {
  const t = useTranslations('calendar');
  const monthDate = monthFromRange(range);
  const monthCells = monthGridCells(monthDate);
  const previousMonth = addMonths(monthDate, -1);
  const nextMonth = addMonths(monthDate, 1);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(31,35,40,0.45)] p-4">
      <div
        aria-modal="true"
        className="grid max-h-[92dvh] w-[min(1100px,100%)] grid-rows-[auto_minmax(0,1fr)_auto] rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xl"
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-[var(--line)] p-5">
          <h2>{t('calendarPngPreview')}</h2>
          <button
            className="h-8 w-8 cursor-pointer rounded-[var(--radius)] border-0 bg-transparent text-2xl text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="min-h-0 overflow-auto bg-[var(--surface-subtle)] p-5">
          <div ref={printableRef} className="w-[1040px] bg-white p-4 text-[#111827]">
            <div className="mb-4 grid grid-cols-[180px_minmax(0,1fr)_180px] items-center gap-4">
              <MiniMonth locale={locale} monthDate={previousMonth} />
              <h2 className="text-center font-serif text-6xl font-normal uppercase leading-none tracking-normal">
                {formatMonthLabel(monthDate.toISOString(), locale)}
              </h2>
              <MiniMonth locale={locale} monthDate={nextMonth} />
            </div>
            <div className="grid grid-cols-7 border-l border-t border-[#d0d7de]">
              {WEEKDAY_KEYS.map((day) => (
                <div
                  key={day}
                  className="border-b border-r border-[#1f2328] p-1.5 text-center text-xs font-semibold"
                >
                  {t(`weekdaysShort.${day}`)}
                </div>
              ))}
              {monthCells.map((day, index) => {
                if (!day) {
                  return (
                    <div
                      aria-hidden="true"
                      className="min-h-[126px] border-b border-r border-[#1f2328]"
                      key={`empty-${index}`}
                    />
                  );
                }

                const key = toDateInputValue(day);
                const dayEvents = events.filter(
                  (event) => toDateInputValue(new Date(event.startsAt)) === key,
                );

                return (
                  <div key={key} className="min-h-[126px] border-b border-r border-[#1f2328] p-1">
                    <div className="mb-0.5 text-2xl font-serif leading-none">{day.getDate()}</div>
                    <div className="grid text-center">
                      {dayEvents.slice(0, 4).map((event) => (
                        <div
                          key={event.occurrenceId}
                          className="flex min-w-0 items-center gap-1 p-1 text-[11px] font-semibold leading-tight text-[#111827]"
                        >
                          {eventImageUrl(event) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              alt=""
                              className="h-10 w-10 min-w-10 -mt-1 rounded-sm object-cover"
                              crossOrigin="anonymous"
                              onError={(errorEvent) => {
                                errorEvent.currentTarget.style.display = 'none';
                              }}
                              src={eventImageUrl(event) ?? undefined}
                            />
                          ) : null}
                          <span className="min-w-0 text-left">{event.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-[var(--line)] p-5">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('close')}
          </Button>
          <Button type="button" onClick={onDownload}>
            {t('downloadPng')}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function MiniMonth({ locale, monthDate }: { locale: string; monthDate: Date }) {
  const t = useTranslations('calendar');
  const cells = monthGridCells(monthDate);

  return (
    <div className="text-center font-serif text-[10px] leading-tight text-[#111827]">
      <div className="mb-1 text-sm font-semibold">
        {formatMonthLabel(monthDate.toISOString(), locale)}
      </div>
      <div className="grid grid-cols-7 gap-x-1">
        {WEEKDAY_KEYS.map((day) => (
          <span className="font-semibold" key={day}>
            {t(`weekdaysShort.${day}`).slice(0, 1)}
          </span>
        ))}
        {cells.map((day, index) => (
          <span key={day ? toDateInputValue(day) : `empty-${index}`}>{day?.getDate() ?? ''}</span>
        ))}
      </div>
    </div>
  );
}

function monthFromRange(range: { rangeStart: string; rangeEnd: string }): Date {
  const start = new Date(range.rangeStart);
  const end = new Date(range.rangeEnd);
  const midpoint = new Date((start.getTime() + end.getTime()) / 2);

  return new Date(midpoint.getFullYear(), midpoint.getMonth(), 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function monthGridCells(monthDate: Date): Array<Date | null> {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const leadingEmptyCells = (firstDay.getDay() + 6) % 7;
  const cells: Array<Date | null> = Array.from({ length: leadingEmptyCells }, () => null);

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}
