'use client';

import type FullCalendar from '@fullcalendar/react';
import { useCallback, useRef, useState } from 'react';
import {
  CALENDAR_VIEW_PARAM,
  DEFAULT_CALENDAR_VIEW,
  FULL_CALENDAR_VIEW,
  type CalendarView,
} from '../_components/calendar-constants';

/**
 * Owns the imperative FullCalendar handle so the custom toolbar and the day strip can drive
 * navigation, and mirrors the active view into the URL without re-running the server component.
 */
export function useCalendarView(initialView: CalendarView) {
  const calendarRef = useRef<FullCalendar>(null);
  const [view, setView] = useState(initialView);
  const [title, setTitle] = useState('');

  const changeView = useCallback((nextView: CalendarView) => {
    setView(nextView);
    calendarRef.current?.getApi().changeView(FULL_CALENDAR_VIEW[nextView]);

    const url = new URL(window.location.href);
    if (nextView === DEFAULT_CALENDAR_VIEW) url.searchParams.delete(CALENDAR_VIEW_PARAM);
    else url.searchParams.set(CALENDAR_VIEW_PARAM, nextView);
    window.history.replaceState(null, '', url);
  }, []);

  const goPrev = useCallback(() => calendarRef.current?.getApi().prev(), []);
  const goNext = useCallback(() => calendarRef.current?.getApi().next(), []);
  const goToday = useCallback(() => calendarRef.current?.getApi().today(), []);
  const gotoDate = useCallback(
    (date: Date | string) => calendarRef.current?.getApi().gotoDate(date),
    [],
  );

  return { calendarRef, changeView, goNext, goPrev, goToday, gotoDate, setTitle, title, view };
}
