'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PrayerRequestItem, PrayerRequestsPayload } from '@churchflow/shared';
import { CardList } from '@/components/ui/card-list';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCursorPagination } from '@/hooks/use-cursor-pagination';
import { PrayerRequestActions } from './prayer-request-actions';
import type { PrayerRequestsListProps } from './prayer-requests-list.types';

type LoadRequests = (input: {
  organizationId: string;
  tab: PrayerRequestsPayload['tab'];
  cursor?: string;
  page: number;
  pageSize: number;
}) => Promise<{ ok: true; payload: PrayerRequestsPayload } | { ok: false; error: string }>;

const getRequestKey = (request: PrayerRequestItem) => request.id;

export function PrayerRequestsCardList({
  disabled,
  loadRequests,
  organizationId,
  payload,
  onUpdate,
  onArchive,
  onRestore,
  onDelete,
}: PrayerRequestsListProps & {
  loadRequests: LoadRequests;
  organizationId: string;
}) {
  const t = useTranslations('prayerRequests');
  const paginationT = useTranslations('pagination');
  const locale = useLocale();
  const isArchivedTab = payload.tab === 'archived';
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );
  const { error, hasMore, isLoading, items, loadMore } = useCursorPagination({
    getItemKey: getRequestKey,
    initialCursor: payload.pagination.nextCursor,
    initialItems: payload.items,
    loadPage: async (cursor) => {
      const result = await loadRequests({
        organizationId,
        tab: payload.tab,
        cursor,
        page: payload.pagination.page,
        pageSize: payload.pagination.pageSize,
      });

      return result.ok
        ? {
            ok: true as const,
            cursor: result.payload.pagination.nextCursor,
            items: result.payload.items,
          }
        : { ok: false as const, error: result.error };
    },
  });

  return (
    <>
      <CardList
        data={items}
        emptyMessage={isArchivedTab ? t('emptyArchived') : t('emptyActive')}
        getCardKey={getRequestKey}
        loadMore={{
          hasMore,
          isLoading,
          label: paginationT('loadMore'),
          loadingLabel: paginationT('loadingMore'),
          onLoadMore: loadMore,
        }}
        renderCard={(request) => (
          <PrayerRequestCard
            actions={
              <PrayerRequestActions
                request={request}
                disabled={disabled}
                onUpdate={onUpdate}
                onArchive={onArchive}
                onRestore={onRestore}
                onDelete={onDelete}
              />
            }
            formattedDate={dateFormatter.format(new Date(request.createdAt))}
            request={request}
            showArchiveReason={isArchivedTab}
          />
        )}
      />
      {error ? <p className="form-error">{error}</p> : null}
    </>
  );
}

function PrayerRequestCard({
  actions,
  formattedDate,
  request,
  showArchiveReason,
}: {
  actions: ReactNode;
  formattedDate: string;
  request: PrayerRequestItem;
  showArchiveReason: boolean;
}) {
  const t = useTranslations('prayerRequests');
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const descriptionRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const description = descriptionRef.current;
    if (!description || expanded) return;

    const measure = () => setClamped(description.scrollHeight > description.clientHeight + 1);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(description);

    return () => observer.disconnect();
  }, [expanded, request.description]);

  const canExpand = expanded || clamped;
  const summary = (
    <>
      {canExpand ? (
        <span
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-[var(--muted)] transition-transform"
        >
          <ChevronIcon expanded={expanded} />
        </span>
      ) : null}
      <span className="grid min-w-0 gap-[3px]">
        <strong className="min-w-0">{request.title}</strong>
        <span
          className={
            expanded
              ? 'whitespace-pre-line text-[var(--muted)]'
              : 'line-clamp-2 text-[var(--muted)]'
          }
          ref={descriptionRef}
        >
          {request.description}
        </span>
      </span>
    </>
  );

  return (
    <>
      <div className="flex min-w-0 items-start gap-2">
        {canExpand ? (
          <button
            aria-expanded={expanded}
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 border-0 bg-transparent p-0 text-left"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {summary}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-2">{summary}</div>
        )}
        {actions}
      </div>
      {showArchiveReason ? (
        <p className="m-0 text-sm text-[var(--muted)]">
          <span className="font-semibold">{t('archiveReasonColumn')}: </span>
          {request.archiveReason ?? t('noArchiveReason')}
        </p>
      ) : null}
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--muted)]">
        <span className="truncate">{request.author.displayName}</span>
        <span aria-hidden="true">·</span>
        <span className="truncate">{formattedDate}</span>
        {request.archivedAt ? (
          <StatusBadge status="archived" label={t('archived')} />
        ) : (
          <StatusBadge status="active" label={t('active')} />
        )}
      </div>
    </>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={expanded ? 'rotate-90' : ''}
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
