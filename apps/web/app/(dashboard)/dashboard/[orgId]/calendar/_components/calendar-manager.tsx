'use client';

import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import FullCalendar from '@fullcalendar/react';
import type {
  DatesSetArg,
  DayCellContentArg,
  EventClickArg,
  EventContentArg,
  EventInput,
} from '@fullcalendar/core';
import ukLocale from '@fullcalendar/core/locales/uk';
import { toPng } from 'html-to-image';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'react-toastify';
import type { CalendarEventItem, CalendarEventsPayload } from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { uploadToSignedUrl } from '@/lib/upload-to-signed-url';
import {
  CALENDAR_TYPE,
  EVENT_TYPES,
  EVENT_TYPE_DOT_STYLES,
  FULL_CALENDAR_VIEW,
  TRANSPARENT_IMAGE_PLACEHOLDER,
  type CalendarView,
} from './calendar-constants';
import { CalendarDayAgenda } from './calendar-day-agenda';
import { calendarEventLinkHref } from './calendar-event-link';
import { CalendarEventsSkeleton } from './calendar-events-skeleton';
import { eventTypesByDate } from './calendar-day-events';
import { eventForm, newEventForm, toDateInputValue } from './calendar-date-utils';
import { isTaskToggleTarget, renderEventContent } from './calendar-event-content';
import { CalendarMobileActions } from './calendar-mobile-actions';
import { CalendarViewSwitch } from './calendar-view-switch';
import { formPayload } from './calendar-form-utils';
import { CalendarPreviewModal } from './calendar-preview-modal';
import { CalendarSidebar } from './calendar-sidebar';
import { EventModal } from './event-modal';
import { EventViewModal } from './event-view-modal';
import type { CalendarFormState, CalendarManagerActions } from './calendar-types';
import styles from './calendar-manager.module.css';

type CalendarRange = { rangeStart: string; rangeEnd: string };
type LoadedCalendarEvents = Pick<CalendarEventsPayload, 'events' | 'members'>;

function rangeKey(range: CalendarRange, types: readonly string[]) {
  return `${range.rangeStart}:${range.rangeEnd}:${types.join(',')}`;
}

function coversRange(outer: CalendarRange, inner: CalendarRange) {
  return (
    new Date(outer.rangeStart) <= new Date(inner.rangeStart) &&
    new Date(outer.rangeEnd) >= new Date(inner.rangeEnd)
  );
}

export function CalendarManager({
  organizationId,
  initialPayload,
  initialRange,
  initialSelectedDate,
  initialViewEvent,
  loadEvents,
  updatePreferences,
  createEvent,
  updateEvent,
  deleteEvent,
  toggleTaskCompletion,
  prepareImage,
  confirmImage,
}: {
  organizationId: string;
  initialPayload: CalendarEventsPayload;
  initialRange: CalendarRange;
  initialSelectedDate: string;
  initialViewEvent: CalendarEventItem | null;
} & CalendarManagerActions) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const isMobile = useIsMobile();
  const fullCalendarLocale = locale === 'uk' ? ukLocale : undefined;
  const [events, setEvents] = useState(initialPayload.events);
  const [members, setMembers] = useState(initialPayload.members);
  const [visibleTypes, setVisibleTypes] = useState(initialPayload.preferences.visibleEventTypes);
  const [range, setRange] = useState(initialRange);
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null);
  const [viewingEvent, setViewingEvent] = useState(initialViewEvent);
  const [form, setForm] = useState<CalendarFormState>(newEventForm(initialSelectedDate));
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>('month');
  const [isPending, startTransition] = useTransition();
  const [loadingRange, setLoadingRange] = useState(false);
  const calendarRef = useRef<FullCalendar>(null);
  const appliedViewport = useRef<boolean | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const lastRangeKey = useRef('');
  const latestRequest = useRef(0);
  const loadedRange = useRef<CalendarRange>(initialRange);
  // Ranges already seen render instantly on revisit and refresh in the background.
  const rangeCache = useRef(new Map<string, LoadedCalendarEvents>());
  const canManage = initialPayload.canManage;

  const calendarEvents = useMemo<EventInput[]>(
    () =>
      events.map((event) => ({
        id: event.occurrenceId,
        title: event.title,
        start: event.startsAt,
        ...(event.endsAt ? { end: event.endsAt } : {}),
        allDay: event.allDay,
        extendedProps: { item: event },
      })),
    [events],
  );
  const selectedDateEvents = useMemo(
    () => events.filter((event) => toDateInputValue(new Date(event.startsAt)) === selectedDate),
    [events, selectedDate],
  );
  const selectedDateTasks = selectedDateEvents.filter((event) => event.type === CALENDAR_TYPE.task);
  const typesByDate = useMemo(() => eventTypesByDate(events), [events]);

  async function refreshEvents(nextRange = range, nextTypes = visibleTypes) {
    const requestId = ++latestRequest.current;
    const result = await loadEvents({
      organizationId,
      rangeStart: nextRange.rangeStart,
      rangeEnd: nextRange.rangeEnd,
      types: nextTypes,
    });
    // A newer navigation superseded this request; its response must not overwrite the view.
    if (requestId !== latestRequest.current) return result.ok;
    setLoadingRange(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }

    rangeCache.current.set(rangeKey(nextRange, nextTypes), {
      events: result.payload.events,
      members: result.payload.members,
    });
    loadedRange.current = nextRange;
    startTransition(() => {
      setError(null);
      setEvents(result.payload.events);
      setMembers(result.payload.members);
    });

    return true;
  }

  function openCreate(date: string) {
    if (!canManage) return;
    setSelectedDate(date);
    setEditingEvent(null);
    setForm(newEventForm(date));
    setModalMode('create');
  }

  function openEdit(event: CalendarEventItem) {
    setSelectedDate(toDateInputValue(new Date(event.startsAt)));
    setEditingEvent(event);
    setForm(eventForm(event));
    setModalMode('edit');
  }

  function openView(event: CalendarEventItem) {
    setSelectedDate(toDateInputValue(new Date(event.startsAt)));
    setViewingEvent(event);
    window.history.replaceState(null, '', calendarEventLinkHref(window.location.href, event));
  }

  function closeView() {
    setViewingEvent(null);
    window.history.replaceState(null, '', calendarEventLinkHref(window.location.href, null));
  }

  function editViewedEvent(event: CalendarEventItem) {
    closeView();
    openEdit(event);
  }

  async function submitForm(nextForm: CalendarFormState) {
    if (!canManage) return { ok: false as const, error: t('cannotManageEvents') };
    const payload = formPayload(nextForm);
    const result =
      modalMode === 'edit' && editingEvent
        ? await updateEvent({
            organizationId,
            eventId: editingEvent.baseEventId,
            event: payload,
          })
        : await createEvent({ organizationId, event: payload });

    if (!result.ok) return result;
    setModalMode(null);
    setError(null);
    rangeCache.current.clear();
    await refreshEvents();
    return { ok: true as const };
  }

  async function removeEvent() {
    if (!canManage || !editingEvent) return;
    const result = await deleteEvent({ organizationId, eventId: editingEvent.baseEventId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setModalMode(null);
    rangeCache.current.clear();
    void refreshEvents();
  }

  async function toggleFilter(type: (typeof visibleTypes)[number]) {
    const nextTypes = visibleTypes.includes(type)
      ? visibleTypes.filter((item) => item !== type)
      : [...visibleTypes, type];
    setVisibleTypes(nextTypes);
    const result = await updatePreferences({ organizationId, visibleEventTypes: nextTypes });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    void refreshEvents(range, nextTypes);
  }

  async function uploadImage(file: File) {
    const prepared = await prepareImage({
      organizationId,
      filename: file.name,
      mimeType: file.type,
      byteSize: file.size,
    });
    if (!prepared.ok) {
      toast.error(prepared.error);
      return null;
    }
    if (!(await uploadToSignedUrl(prepared.uploadUrl, file))) {
      toast.error(t('imageUploadFailed'));
      return null;
    }
    const confirmed = await confirmImage({ organizationId, assetId: prepared.assetId });
    if (!confirmed.ok) {
      toast.error(confirmed.error);
      return null;
    }
    return { assetId: confirmed.assetId, imageUrl: confirmed.imageUrl };
  }

  async function toggleTask(event: CalendarEventItem, completed: boolean) {
    if (!canManage) return;
    const result = await toggleTaskCompletion({
      organizationId,
      eventId: event.baseEventId,
      completed,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    rangeCache.current.clear();
    setEvents((current) =>
      current.map((item) =>
        item.baseEventId === event.baseEventId ? { ...item, taskCompleted: completed } : item,
      ),
    );
  }

  async function downloadPng() {
    if (!printRef.current) return;
    try {
      const dataUrl = await toPng(printRef.current, {
        backgroundColor: '#ffffff',
        imagePlaceholder: TRANSPARENT_IMAGE_PLACEHOLDER,
        includeQueryParams: true,
        onImageErrorHandler: () => undefined,
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `churchflow-calendar-${range.rangeStart.slice(0, 7)}.png`;
      link.href = dataUrl;
      link.click();
      setError(null);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : t('pngExportFailed'));
    }
  }

  function handleDatesSet(arg: DatesSetArg) {
    const nextRange = {
      rangeStart: arg.start.toISOString(),
      rangeEnd: arg.end.toISOString(),
    };
    const key = rangeKey(nextRange, visibleTypes);
    setRange(nextRange);
    if (lastRangeKey.current === key) return;
    const isInitialRange = lastRangeKey.current === '';
    lastRangeKey.current = key;

    const cached = rangeCache.current.get(key);
    if (cached) {
      setEvents(cached.events);
      setMembers(cached.members);
      setLoadingRange(false);
    } else if (!isInitialRange && !coversRange(loadedRange.current, nextRange)) {
      setLoadingRange(true);
    }
    void refreshEvents(nextRange);
  }

  function handleViewChange(nextView: CalendarView) {
    setView(nextView);
    calendarRef.current?.getApi().changeView(FULL_CALENDAR_VIEW[nextView]);
  }

  // The view switch is mobile-only, so a week view has to be reverted once the viewport
  // grows, otherwise desktop is left in week view with no control to leave it.
  useEffect(() => {
    if (appliedViewport.current === isMobile) return undefined;
    appliedViewport.current = isMobile;
    const timer = setTimeout(() => handleViewChange(isMobile ? 'week' : 'month'), 0);

    return () => clearTimeout(timer);
  }, [isMobile]);

  function handleDateClick(arg: DateClickArg) {
    const date = toDateInputValue(arg.date);
    setSelectedDate(date);
    // On mobile a tap only picks the day for the agenda; the new event button creates.
    if (!isMobile) openCreate(date);
  }

  function handleEventClick(arg: EventClickArg) {
    if (isTaskToggleTarget(arg.jsEvent.target)) return;
    const item = arg.event.extendedProps['item'] as CalendarEventItem | undefined;
    if (item) openView(item);
  }

  function handleTaskToggle(event: CalendarEventItem, completed: boolean) {
    void toggleTask(event, completed);
  }

  function handleEventContent(arg: EventContentArg) {
    return renderEventContent(arg, {
      canManage,
      markCompleteLabel: t('markComplete'),
      markIncompleteLabel: t('markIncomplete'),
      typeLabel: (type) => t(`eventTypes.${type}`),
      onTaskToggle: handleTaskToggle,
    });
  }

  function handleDayCellContent(arg: DayCellContentArg) {
    const types =
      arg.view.type === FULL_CALENDAR_VIEW.month
        ? typesByDate.get(toDateInputValue(arg.date))
        : undefined;

    return (
      <>
        {arg.dayNumberText}
        {types ? (
          <span aria-hidden="true" className="flex gap-0.5 md:hidden">
            {types.map((type) => (
              <span
                className={`h-1.5 w-1.5 rounded-full ${EVENT_TYPE_DOT_STYLES[type]}`}
                key={type}
              />
            ))}
          </span>
        ) : null}
      </>
    );
  }

  function handleDayCellClassNames(arg: DayCellContentArg) {
    return toDateInputValue(arg.date) === selectedDate ? [styles['selectedDay'] ?? ''] : [];
  }

  return (
    <div className="grid min-h-[680px] gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
      <div className="order-2 min-w-0 max-md:hidden xl:order-none">
        <CalendarSidebar
          canManage={canManage}
          loading={loadingRange}
          selectedDate={selectedDate}
          selectedDateEvents={selectedDateEvents}
          selectedDateTasks={selectedDateTasks}
          visibleTypes={visibleTypes}
          onEventOpen={openView}
          onFilterToggle={(type) => void toggleFilter(type)}
          onTaskToggle={(event, completed) => void toggleTask(event, completed)}
        />
      </div>

      <section className="order-1 min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm xl:order-none">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {canManage ? (
              <Button className="max-md:hidden" onClick={() => openCreate(selectedDate)}>
                {t('newEvent')}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={() => setPreviewOpen(true)}>
              {t('previewPng')}
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            {EVENT_TYPES.map((type) => (
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] max-md:hidden"
                key={type.value}
              >
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 rounded-full ${EVENT_TYPE_DOT_STYLES[type.value]}`}
                />
                {t(`eventTypes.${type.value}`)}
              </span>
            ))}
            <CalendarMobileActions
              canManage={canManage}
              visibleTypes={visibleTypes}
              onCreate={() => openCreate(selectedDate)}
              onFilterToggle={(type) => void toggleFilter(type)}
            />
          </div>
        </div>
        {error ? <p className="form-error mb-3">{error}</p> : null}
        <CalendarViewSwitch value={view} onChange={handleViewChange} />
        <span aria-live="polite" className="sr-only">
          {loadingRange ? t('updatingCalendar') : ''}
        </span>
        <div
          aria-busy={loadingRange}
          className={styles['calendarRoot']}
          data-loading={loadingRange}
        >
          <FullCalendar
            datesSet={handleDatesSet}
            dateClick={handleDateClick}
            dayCellClassNames={handleDayCellClassNames}
            dayCellContent={handleDayCellContent}
            eventClick={handleEventClick}
            eventContent={handleEventContent}
            events={calendarEvents}
            firstDay={1}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: '',
            }}
            buttonText={{ today: t('today') }}
            dayMaxEvents={4}
            height="auto"
            initialDate={initialSelectedDate}
            initialView="dayGridMonth"
            {...(fullCalendarLocale ? { locale: fullCalendarLocale } : {})}
            moreLinkClick="popover"
            {...(loadingRange
              ? { noEventsContent: () => <CalendarEventsSkeleton rows={4} /> }
              : {})}
            plugins={[dayGridPlugin, interactionPlugin, listPlugin]}
            ref={calendarRef}
            views={{
              listWeek: {
                listDayFormat: { weekday: 'long', day: 'numeric', month: 'long' },
                listDaySideFormat: false,
              },
            }}
          />
        </div>
        {view === 'month' ? (
          <CalendarDayAgenda
            canManage={canManage}
            loading={loadingRange}
            selectedDate={selectedDate}
            selectedDateEvents={selectedDateEvents}
            onEventOpen={openView}
            onTaskToggle={(event, completed) => void toggleTask(event, completed)}
          />
        ) : null}
      </section>

      {modalMode ? (
        <EventModal
          canManage={canManage}
          editingEvent={editingEvent}
          form={form}
          members={members}
          mode={modalMode}
          pending={isPending}
          onClose={() => setModalMode(null)}
          onDelete={() => void removeEvent()}
          onImageUpload={uploadImage}
          onSubmit={submitForm}
        />
      ) : null}

      {viewingEvent ? (
        <EventViewModal
          canManage={canManage}
          event={viewingEvent}
          key={viewingEvent.occurrenceId}
          onClose={closeView}
          onEdit={() => editViewedEvent(viewingEvent)}
        />
      ) : null}

      {previewOpen ? (
        <CalendarPreviewModal
          events={events}
          locale={locale}
          printableRef={printRef}
          range={range}
          onClose={() => setPreviewOpen(false)}
          onDownload={() => void downloadPng()}
        />
      ) : null}
    </div>
  );
}
