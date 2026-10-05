'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Fragment, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  CALENDAR_EVENT_REPEAT_PERIOD,
  type CalendarEventItem,
  type CalendarEventMemberSummary,
  type CalendarServicePerson,
} from '@churchflow/shared';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { RichTextContent } from '@/components/ui/rich-text-content';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { CALENDAR_TYPE, EVENT_TYPE_DOT_STYLES, EVENT_TYPE_STYLES } from './calendar-constants';
import { formatEventSchedule } from './calendar-date-utils';
import { calendarEventLinkHref } from './calendar-event-link';
import {
  eventViewDetailsClassName,
  eventViewPersonClassName,
  eventViewSectionTitleClassName,
  eventViewTermClassName,
} from './event-view-modal.styles';

type EventViewPerson = Pick<
  CalendarEventMemberSummary | CalendarServicePerson,
  'displayName' | 'photoUrl'
>;

function Person({ person }: { person: EventViewPerson }) {
  return (
    <dd className={eventViewPersonClassName}>
      <Avatar displayName={person.displayName} fallback="initials" url={person.photoUrl} />
      {person.displayName}
    </dd>
  );
}

export function EventViewModal({
  canManage,
  event,
  onClose,
  onEdit,
}: {
  canManage: boolean;
  event: CalendarEventItem;
  onClose: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations('calendar');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isMobile = useIsMobile();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const schedule = formatEventSchedule(event, locale);
  const service = event.type === CALENDAR_TYPE.service ? event.serviceDetails : null;
  const servicePeople = service
    ? [
        { label: t('preacher'), person: service.preacher },
        { label: t('serviceHost'), person: service.serviceHost },
        { label: t('worshipLead'), person: service.worshipLead },
      ]
    : [];
  const hasServiceDetails =
    service !== null &&
    (servicePeople.some(({ person }) => person !== null) ||
      service.hasCommunion ||
      Boolean(service.biblePassage) ||
      service.songs.length > 0);
  const meta = [
    schedule.time,
    event.repeatPeriod !== CALENDAR_EVENT_REPEAT_PERIOD.none
      ? t(`repeatPeriods.${event.repeatPeriod}`)
      : null,
    event.reminder ? t(`reminders.${event.reminder}`) : null,
  ].filter((item): item is string => item !== null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  async function share() {
    const url = calendarEventLinkHref(window.location.href, event);
    if (isMobile && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: event.title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('view.linkCopied'));
    } catch {
      toast.error(t('view.copyFailed'));
    }
  }

  return (
    <FormDialog
      dialogRef={dialogRef}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:w-full sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="secondary" onClick={() => void share()}>
            {t('view.share')}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              className="max-sm:hidden"
              type="button"
              variant="secondary"
              onClick={() => dialogRef.current?.close()}
            >
              {t('close')}
            </Button>
            {canManage ? (
              <Button type="button" onClick={onEdit}>
                {tCommon('edit')}
              </Button>
            ) : null}
          </div>
        </div>
      }
      fullScreenOnMobile
      size="lg"
      title={event.title}
      onClose={onClose}
    >
      <div className="grid gap-5">
        {event.image?.url ? (
          <a
            aria-label={t('view.openImage')}
            className="block overflow-hidden rounded-lg bg-[var(--surface-subtle)]"
            href={event.image.url}
            rel="noreferrer"
            target="_blank"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={t('eventImage')}
              className="mx-auto block max-h-72 w-full object-contain"
              src={event.image.url}
            />
          </a>
        ) : null}

        <div className="grid gap-2">
          <span
            className={`inline-flex items-center gap-1.5 justify-self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${EVENT_TYPE_STYLES[event.type]}`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${EVENT_TYPE_DOT_STYLES[event.type]}`}
            />
            {t(`eventTypes.${event.type}`)}
          </span>
          <p className="m-0 font-semibold first-letter:uppercase">{schedule.date}</p>
          {meta.length > 0 ? <p className="m-0 text-[var(--muted)]">{meta.join(' · ')}</p> : null}
        </div>

        {event.linkedMember || event.assignees.length > 0 || event.type === CALENDAR_TYPE.task ? (
          <dl className={eventViewDetailsClassName}>
            {event.linkedMember ? (
              <>
                <dt className={eventViewTermClassName}>{t('linkedMember')}</dt>
                <Person person={event.linkedMember} />
              </>
            ) : null}
            {event.assignees.length > 0 ? (
              <>
                <dt className={`${eventViewTermClassName} sm:self-start sm:pt-2`}>
                  {t('assignees')}
                </dt>
                <dd className="m-0 grid gap-2">
                  {event.assignees.map((assignee) => (
                    <span className={eventViewPersonClassName} key={assignee.id}>
                      <Avatar
                        displayName={assignee.displayName}
                        fallback="initials"
                        url={assignee.photoUrl}
                      />
                      {assignee.displayName}
                    </span>
                  ))}
                </dd>
              </>
            ) : null}
            {event.type === CALENDAR_TYPE.task ? (
              <>
                <dt className={eventViewTermClassName}>{t('view.status')}</dt>
                <dd className="m-0">
                  {event.taskCompleted ? t('completed') : t('view.notCompleted')}
                </dd>
              </>
            ) : null}
          </dl>
        ) : null}

        {service && hasServiceDetails ? (
          <section className="grid gap-3">
            <h3 className={eventViewSectionTitleClassName}>{t('serviceDetails')}</h3>
            <dl className={eventViewDetailsClassName}>
              {servicePeople.map(({ label, person }) =>
                person ? (
                  <Fragment key={label}>
                    <dt className={eventViewTermClassName}>{label}</dt>
                    <Person person={person} />
                  </Fragment>
                ) : null,
              )}
              {service.hasCommunion ? (
                <>
                  <dt className={eventViewTermClassName}>{t('communion')}</dt>
                  {service.communionLead ? (
                    <Person person={service.communionLead} />
                  ) : (
                    <dd className="m-0">{t('view.communionPlanned')}</dd>
                  )}
                </>
              ) : null}
              {service.biblePassage ? (
                <>
                  <dt className={eventViewTermClassName}>{t('biblePassage')}</dt>
                  <dd className="m-0">{service.biblePassage}</dd>
                </>
              ) : null}
              {service.songs.length > 0 ? (
                <>
                  <dt className={`${eventViewTermClassName} sm:self-start`}>{t('songs')}</dt>
                  <dd className="m-0">
                    <ol className="m-0 grid gap-0.5 pl-5">
                      {service.songs.map((song, index) => (
                        <li key={`${index}-${song}`}>{song}</li>
                      ))}
                    </ol>
                  </dd>
                </>
              ) : null}
            </dl>
          </section>
        ) : null}

        {event.description ? (
          <section className="grid gap-2 border-t border-[var(--line-muted)] pt-4">
            <h3 className={eventViewSectionTitleClassName}>{t('description')}</h3>
            <RichTextContent html={event.description} />
          </section>
        ) : null}
      </div>
    </FormDialog>
  );
}
