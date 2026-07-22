'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { CalendarServiceRole, type NotificationDetail } from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { useNotificationDetail } from '../hooks/use-notification-detail';

export function NotificationDetailModal({ organizationId }: { organizationId: string }) {
  const locale = useLocale();
  const t = useTranslations('notifications');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const notificationId = searchParams.get('notificationId');
  const notificationQuery = useNotificationDetail({ organizationId, notificationId });
  const notification = notificationQuery.data ?? null;

  const closeHref = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('notificationId');
    const query = next.toString();

    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  if (!notificationId) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(31,35,40,0.45)] p-4">
      <section
        aria-label={t('detailAriaLabel')}
        aria-modal="true"
        className="grid max-h-[min(720px,90dvh)] w-[min(560px,calc(100vw-32px))] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[0_16px_48px_rgba(31,35,40,0.2)]"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] p-4">
          <div className="min-w-0">
            <h2 className="m-0 text-lg">{t('detailTitle')}</h2>
            <p className="m-0 text-sm text-[var(--muted)]">
              {notification ? formatDateTime(notification.createdAt, locale) : t('loading')}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('closeDetail')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-lg leading-none hover:bg-[var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0969da]"
            onClick={() => router.replace(closeHref as Route)}
          >
            &times;
          </button>
        </header>

        <div className="overflow-auto p-4">
          {notificationQuery.isLoading ? (
            <p className="m-0 text-sm text-[var(--muted)]">{t('loadingNotification')}</p>
          ) : notificationQuery.isError ? (
            <p className="form-error m-0">{t('detailCouldNotLoad')}</p>
          ) : notification ? (
            <div className="stack">
              <div className="stack gap-1">
                <h3 className="m-0 text-xl">{notification.title}</h3>
                {notification.body ? (
                  <p className="m-0 whitespace-pre-line text-[var(--muted)]">{notification.body}</p>
                ) : null}
              </div>

              {notification.calendarEvent ? (
                <CalendarEventNotificationDetail
                  event={notification.calendarEvent}
                  locale={locale}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="flex justify-end border-t border-[var(--line)] p-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.replace(closeHref as Route)}
          >
            {t('close')}
          </Button>
        </footer>
      </section>
    </div>
  );
}

function CalendarEventNotificationDetail({
  event,
  locale,
}: {
  event: NonNullable<NotificationDetail['calendarEvent']>;
  locale: string;
}) {
  const calendarT = useTranslations('calendar');
  const t = useTranslations('notifications');
  const serviceRoleLabels: Record<CalendarServiceRole, string> = {
    COMMUNION_LEAD: t('serviceRoles.COMMUNION_LEAD'),
    PREACHER: t('serviceRoles.PREACHER'),
    SERVICE_HOST: t('serviceRoles.SERVICE_HOST'),
    WORSHIP_LEAD: t('serviceRoles.WORSHIP_LEAD'),
  };

  return (
    <section className="stack gap-3 rounded-[var(--radius)] border border-[var(--line)] p-4">
      <div>
        <h4 className="m-0 text-base">{event.title}</h4>
        <p className="m-0 text-sm text-[var(--muted)]">{calendarT(`eventTypes.${event.type}`)}</p>
      </div>
      <dl className="m-0 grid gap-2 text-sm">
        <DetailRow label={t('starts')} value={formatDateTime(event.startsAt, locale)} />
        {event.endsAt ? (
          <DetailRow label={t('ends')} value={formatDateTime(event.endsAt, locale)} />
        ) : null}
        {event.description ? (
          <DetailRow label={t('description')} value={event.description} />
        ) : null}
      </dl>
      {event.assignees.length > 0 ? (
        <PeopleList
          label={t('assignees')}
          names={event.assignees.map((assignee) => assignee.displayName)}
        />
      ) : null}
      {event.participants.length > 0 ? (
        <PeopleList
          label={t('participants')}
          names={event.participants.map(
            (participant) => `${serviceRoleLabels[participant.role]}: ${participant.displayName}`,
          )}
        />
      ) : null}
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[96px_minmax(0,1fr)]">
      <dt className="font-semibold text-[var(--foreground)]">{label}</dt>
      <dd className="m-0 text-[var(--muted)]">{value}</dd>
    </div>
  );
}

function PeopleList({ label, names }: { label: string; names: string[] }) {
  return (
    <div className="stack gap-1">
      <h5 className="m-0 text-sm">{label}</h5>
      <ul className="m-0 grid gap-1 pl-4 text-sm text-[var(--muted)]">
        {names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
}

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
