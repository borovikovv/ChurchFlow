'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { useEffect, useMemo, useState } from 'react';
import type { NotificationDetail } from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { getNotificationDetail, markNotificationRead } from '../actions';

export function NotificationDetailModal({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const notificationId = searchParams.get('notificationId');
  const [notification, setNotification] = useState<NotificationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeHref = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('notificationId');
    const query = next.toString();

    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!notificationId) {
      setNotification(null);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    getNotificationDetail({ organizationId, notificationId })
      .then((detail) => {
        if (!active) return;
        setNotification(detail);
        if (!detail.readAt) {
          void markNotificationRead({ organizationId, notificationId }).catch(() => undefined);
        }
      })
      .catch(() => {
        if (active) setError('Notification could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [notificationId, organizationId]);

  if (!notificationId) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(31,35,40,0.45)] p-4">
      <section
        aria-label="Notification detail"
        aria-modal="true"
        className="grid max-h-[min(720px,90dvh)] w-[min(560px,calc(100vw-32px))] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[0_16px_48px_rgba(31,35,40,0.2)]"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] p-4">
          <div className="min-w-0">
            <h2 className="m-0 text-lg">Notification</h2>
            <p className="m-0 text-sm text-[var(--muted)]">
              {notification ? formatDateTime(notification.createdAt) : 'Loading...'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close notification detail"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-lg leading-none hover:bg-[var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0969da]"
            onClick={() => router.replace(closeHref as Route)}
          >
            &times;
          </button>
        </header>

        <div className="overflow-auto p-4">
          {loading ? (
            <p className="m-0 text-sm text-[var(--muted)]">Loading notification...</p>
          ) : error ? (
            <p className="form-error m-0">{error}</p>
          ) : notification ? (
            <div className="stack">
              <div className="stack gap-1">
                <h3 className="m-0 text-xl">{notification.title}</h3>
                {notification.body ? (
                  <p className="m-0 whitespace-pre-line text-[var(--muted)]">{notification.body}</p>
                ) : null}
              </div>

              {notification.calendarEvent ? (
                <CalendarEventNotificationDetail event={notification.calendarEvent} />
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
            Close
          </Button>
        </footer>
      </section>
    </div>
  );
}

function CalendarEventNotificationDetail({
  event,
}: {
  event: NonNullable<NotificationDetail['calendarEvent']>;
}) {
  return (
    <section className="stack gap-3 rounded-[var(--radius)] border border-[var(--line)] p-4">
      <div>
        <h4 className="m-0 text-base">{event.title}</h4>
        <p className="m-0 text-sm text-[var(--muted)]">{formatEventType(event.type)}</p>
      </div>
      <dl className="m-0 grid gap-2 text-sm">
        <DetailRow label="Starts" value={formatDateTime(event.startsAt)} />
        {event.endsAt ? <DetailRow label="Ends" value={formatDateTime(event.endsAt)} /> : null}
        {event.description ? <DetailRow label="Description" value={event.description} /> : null}
      </dl>
      {event.assignees.length > 0 ? (
        <PeopleList
          label="Assignees"
          names={event.assignees.map((assignee) => assignee.displayName)}
        />
      ) : null}
      {event.participants.length > 0 ? (
        <PeopleList
          label="Participants"
          names={event.participants.map(
            (participant) => `${formatServiceRole(participant.role)}: ${participant.displayName}`,
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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  }).format(new Date(value));
}

function formatEventType(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatServiceRole(value: string): string {
  switch (value) {
    case 'PREACHER':
      return 'Preacher';
    case 'SERVICE_HOST':
      return 'Host';
    case 'WORSHIP_LEAD':
      return 'Worship';
    case 'COMMUNION_LEAD':
      return 'Communion';
    default:
      return formatEventType(value);
  }
}
