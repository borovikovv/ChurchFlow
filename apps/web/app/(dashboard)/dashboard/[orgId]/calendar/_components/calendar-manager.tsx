'use client';

import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import type { DatesSetArg, EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core';
import ukLocale from '@fullcalendar/core/locales/uk';
import { toPng } from 'html-to-image';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'react-toastify';
import type { CalendarEventItem, CalendarEventsPayload } from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { NotificationDetailModal } from '@/features/notifications/components/notification-detail-modal';
import {
  CALENDAR_TYPE,
  FULL_CALENDAR_VIEW,
  TRANSPARENT_IMAGE_PLACEHOLDER,
  type CalendarView,
} from './calendar-constants';
import { CalendarDayStrip } from './calendar-day-strip';
import { eventForm, newEventForm, toDateInputValue } from './calendar-date-utils';
import { renderEventContent } from './calendar-event-content';
import { CalendarFilters } from './calendar-filters';
import { CalendarToolbar } from './calendar-toolbar';
import { formPayload } from './calendar-form-utils';
import { CalendarPreviewModal } from './calendar-preview-modal';
import { CalendarSidebar } from './calendar-sidebar';
import { EventModal } from './event-modal';
import { useCalendarView } from '../_hooks/use-calendar-view';
import type { CalendarFormState, CalendarManagerActions } from './calendar-types';
import styles from './calendar-manager.module.css';

export function CalendarManager({
  organizationId,
  initialPayload,
  initialRange,
  initialSelectedDate,
  initialView,
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
  initialRange: { rangeStart: string; rangeEnd: string };
  initialSelectedDate: string;
  initialView: CalendarView;
} & CalendarManagerActions) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const isMobile = useIsMobile();
  const fullCalendarLocale = locale === 'uk' ? ukLocale : undefined;
  const { calendarRef, changeView, goNext, goPrev, goToday, gotoDate, setTitle, title, view } =
    useCalendarView(initialView);
  const [events, setEvents] = useState(initialPayload.events);
  const [members, setMembers] = useState(initialPayload.members);
  const [visibleTypes, setVisibleTypes] = useState(initialPayload.preferences.visibleEventTypes);
  const [range, setRange] = useState(initialRange);
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null);
  const [form, setForm] = useState<CalendarFormState>(newEventForm(initialSelectedDate));
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const printRef = useRef<HTMLDivElement>(null);
  const lastRangeKey = useRef('');
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

  async function refreshEvents(nextRange = range, nextTypes = visibleTypes) {
    const result = await loadEvents({
      organizationId,
      rangeStart: nextRange.rangeStart,
      rangeEnd: nextRange.rangeEnd,
      types: nextTypes,
    });
    if (!result.ok) {
      setError(result.error);
      return false;
    }

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
    const upload = await fetch(prepared.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': file.type },
      body: file,
    });
    if (!upload.ok) {
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
    const key = `${nextRange.rangeStart}:${nextRange.rangeEnd}:${visibleTypes.join(',')}`;
    setRange(nextRange);
    setTitle(arg.view.title);
    // Keep the agenda on a day the timed views actually show; month view keeps its own selection.
    if (view !== 'month') {
      const firstVisibleDay = toDateInputValue(arg.start);
      const lastVisibleDay = toDateInputValue(new Date(arg.end.getTime() - 1));
      if (selectedDate < firstVisibleDay || selectedDate > lastVisibleDay) {
        setSelectedDate(firstVisibleDay);
      }
    }
    if (lastRangeKey.current === key) return;
    lastRangeKey.current = key;
    void refreshEvents(nextRange);
  }

  function handleDaySelect(date: string) {
    // gotoDate first: its synchronous datesSet may reset the selection, and this write must win.
    gotoDate(`${date}T12:00`);
    setSelectedDate(date);
  }

  function handleDateClick(arg: DateClickArg) {
    setSelectedDate(arg.dateStr);
    openCreate(arg.dateStr);
  }

  function handleEventClick(arg: EventClickArg) {
    const item = arg.event.extendedProps['item'] as CalendarEventItem | undefined;
    if (item) openEdit(item);
  }

  function handleTaskToggle(event: CalendarEventItem, completed: boolean) {
    void toggleTask(event, completed);
  }

  function handleEventContent(arg: EventContentArg) {
    return renderEventContent(arg, {
      canManage,
      markCompleteLabel: t('markComplete'),
      markIncompleteLabel: t('markIncomplete'),
      onTaskToggle: handleTaskToggle,
    });
  }

  return (
    <div className="grid gap-4 md:min-h-[680px] xl:grid-cols-[260px_minmax(0,1fr)]">
      <div className="order-2 min-w-0 xl:order-none">
        <CalendarSidebar
          canManage={canManage}
          selectedDate={selectedDate}
          selectedDateEvents={selectedDateEvents}
          selectedDateTasks={selectedDateTasks}
          onEventOpen={openEdit}
          onTaskToggle={(event, completed) => void toggleTask(event, completed)}
        />
      </div>

      <section className="order-1 min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm xl:order-none">
        <CalendarToolbar
          actions={
            <>
              {canManage ? (
                <Button onClick={() => openCreate(selectedDate)}>{t('newEvent')}</Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={() => setPreviewOpen(true)}>
                {t('previewPng')}
              </Button>
              {isPending ? (
                <span className="text-sm text-[var(--muted)]">{t('updatingCalendar')}</span>
              ) : null}
            </>
          }
          onNext={goNext}
          onPrev={goPrev}
          onToday={goToday}
          onViewChange={changeView}
          title={title}
          view={view}
        />
        <CalendarFilters visibleTypes={visibleTypes} onToggle={(type) => void toggleFilter(type)} />
        {view === 'month' ? null : (
          <CalendarDayStrip selectedDate={selectedDate} onSelect={handleDaySelect} />
        )}
        {error ? <p className="form-error mb-3">{error}</p> : null}
        <div className={styles['calendarRoot']}>
          <FullCalendar
            allDaySlot
            datesSet={handleDatesSet}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            eventContent={handleEventContent}
            events={calendarEvents}
            firstDay={1}
            headerToolbar={false}
            dayMaxEvents={isMobile ? 2 : 4}
            height="auto"
            initialView={FULL_CALENDAR_VIEW[initialView]}
            {...(fullCalendarLocale ? { locale: fullCalendarLocale } : {})}
            moreLinkClick="popover"
            nowIndicator
            plugins={[dayGridPlugin, interactionPlugin, timeGridPlugin]}
            ref={calendarRef}
            scrollTime="08:00:00"
            slotDuration="01:00:00"
          />
        </div>
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

      <NotificationDetailModal organizationId={organizationId} />
    </div>
  );
}
