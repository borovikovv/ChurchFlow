'use client';

import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { NotificationListItem } from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { useCloseOnOutsideClick } from '@/hooks/use-close-on-outside-click';
import {
  getNotificationsSummary,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../actions';

const PAGE_SIZE = 20;
const ISO_DATE_TIME_PATTERN = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z/g;

export function NotificationBell({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const outsideClickRefs = useMemo(() => [containerRef], []);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationListItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useCloseOnOutsideClick({
    enabled: open,
    refs: outsideClickRefs,
    onOutsideClick: useCallback(() => setOpen(false), []),
  });

  useEffect(() => {
    let active = true;

    getNotificationsSummary(organizationId)
      .then((summary) => {
        if (!active) return;
        setUnreadCount(summary.unreadCount);
        setItems(summary.recentItems);
        setNextCursor(null);
      })
      .catch(() => {
        if (active) setError('Notifications could not be loaded.');
      });

    return () => {
      active = false;
    };
  }, [organizationId]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const loadFirstPage = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const page = await listNotifications({ organizationId, limit: PAGE_SIZE });
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setUnreadCount(page.unreadCount);
      setLoaded(true);
    } catch {
      setError('Notifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [loading, organizationId]);

  const loadNextPage = useCallback(async () => {
    if (loading || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    setError(null);

    try {
      const page = await listNotifications({
        organizationId,
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      setItems((current) => appendUniqueNotifications(current, page.items));
      setNextCursor(page.nextCursor);
      setUnreadCount(page.unreadCount);
    } catch {
      setError('More notifications could not be loaded.');
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, nextCursor, organizationId]);

  const toggleOpen = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen && !loaded) {
      await loadFirstPage();
    }
  };

  const handleNotificationClick = async (notification: NotificationListItem) => {
    if (!notification.readAt) {
      const now = new Date().toISOString();
      setItems((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, readAt: now } : item)),
      );
      setUnreadCount((count) => Math.max(0, count - 1));

      try {
        const updated = await markNotificationRead({
          organizationId,
          notificationId: notification.id,
        });
        setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      } catch {
        setError('Notification could not be marked as read.');
      }
    }

    if (notification.url) {
      setOpen(false);
      const url = notificationDetailUrl(notification.url, notification.id);
      if (url.startsWith('/')) {
        router.push(url as Route);
      } else {
        window.location.assign(url);
      }
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAllRead) return;
    const now = new Date().toISOString();
    const previousItems = items;
    const previousUnreadCount = unreadCount;

    setMarkingAllRead(true);
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    setUnreadCount(0);

    try {
      await markAllNotificationsRead(organizationId);
    } catch {
      setItems(previousItems);
      setUnreadCount(previousUnreadCount);
      setError('Notifications could not be marked as read.');
    } finally {
      setMarkingAllRead(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] transition hover:bg-[var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0969da]"
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Open notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggleOpen}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#cf222e] px-1.5 text-center text-xs font-bold leading-5 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          className="absolute right-0 top-12 z-30 grid w-[min(380px,calc(100vw-32px))] gap-0 overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] p-3">
            <div>
              <h2 className="m-0 text-base font-semibold">Notifications</h2>
              <p className="m-0 text-xs text-[var(--muted)]">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="min-h-8 px-2 py-1 text-xs"
              disabled={unreadCount === 0 || markingAllRead}
              onClick={handleMarkAllRead}
            >
              Mark all as read
            </Button>
          </div>

          {error ? (
            <p className="m-0 border-b border-[var(--line)] px-3 py-2 text-sm text-[#cf222e]">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="m-0 px-3 py-8 text-center text-sm text-[var(--muted)]">
              Loading notifications...
            </p>
          ) : items.length === 0 ? (
            <p className="m-0 px-3 py-8 text-center text-sm text-[var(--muted)]">
              No notifications yet.
            </p>
          ) : (
            <div className="h-[360px]" role="menu" aria-label="Notification list">
              <Virtuoso
                data={items}
                endReached={loadNextPage}
                computeItemKey={(_, notification) => notification.id}
                itemContent={(_, notification) => (
                  <NotificationRow
                    notification={notification}
                    onSelect={() => handleNotificationClick(notification)}
                  />
                )}
                components={{
                  Footer: () => (
                    <NotificationListFooter loading={loadingMore} hasMore={Boolean(nextCursor)} />
                  ),
                }}
              />
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function NotificationRow({
  notification,
  onSelect,
}: {
  notification: NotificationListItem;
  onSelect: () => void;
}) {
  const unread = !notification.readAt;

  return (
    <button
      type="button"
      role="menuitem"
      className={[
        'grid w-full gap-1 border-b border-[var(--line)] px-3 py-3 text-left transition hover:bg-[var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#0969da]',
        unread ? 'bg-[#fff8f2]' : 'bg-[var(--surface)] text-[var(--muted)]',
      ].join(' ')}
      onClick={onSelect}
    >
      <span className="flex min-w-0 items-start justify-between gap-3">
        <span className="min-w-0 font-semibold text-[var(--foreground)]">{notification.title}</span>
        {unread ? (
          <span className="mt-1 h-2 w-2 flex-none rounded-full bg-[#0969da]" aria-label="Unread" />
        ) : null}
      </span>
      {notification.body ? (
        <span className="line-clamp-2 text-sm text-[var(--muted)]">
          {formatNotificationBody(notification.body)}
        </span>
      ) : null}
      <span className="text-xs text-[var(--muted)]">
        {formatNotificationTime(notification.createdAt)}
      </span>
    </button>
  );
}

function NotificationListFooter({ loading, hasMore }: { loading: boolean; hasMore: boolean }) {
  if (loading) {
    return <p className="m-0 px-3 py-3 text-center text-sm text-[var(--muted)]">Loading more...</p>;
  }

  if (!hasMore) {
    return <p className="m-0 px-3 py-3 text-center text-xs text-[var(--muted)]">End of list</p>;
  }

  return <div className="h-2" aria-hidden />;
}

function appendUniqueNotifications(
  current: NotificationListItem[],
  next: NotificationListItem[],
): NotificationListItem[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !seen.has(item.id))];
}

function formatNotificationTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatNotificationBody(value: string): string {
  return value.replace(ISO_DATE_TIME_PATTERN, (match) => formatNotificationDateTime(match));
}

function formatNotificationDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function notificationDetailUrl(url: string, notificationId: string): string {
  const separator = url.includes('?') ? '&' : '?';

  return `${url}${separator}notificationId=${encodeURIComponent(notificationId)}`;
}

function BellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M18 9.5a6 6 0 0 0-12 0c0 6-2 6.5-2 8h16c0-1.5-2-2-2-8Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9.75 20a2.5 2.5 0 0 0 4.5 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
