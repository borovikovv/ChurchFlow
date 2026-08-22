'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';
import type { PrayerRequestItem } from '@churchflow/shared';
import { PRAYER_REQUEST_PAGE_SIZE_OPTIONS } from '@churchflow/shared';
import { CardList } from '@/components/ui/card-list';
import { createDataTablePagination } from '@/components/ui/data-table-pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { PrayerRequestActions } from './prayer-request-actions';
import type { PrayerRequestsListProps } from './prayer-requests-list.types';

export function PrayerRequestsCardList({
  disabled,
  payload,
  onUpdate,
  onArchive,
  onRestore,
  onDelete,
}: PrayerRequestsListProps) {
  const t = useTranslations('prayerRequests');
  const paginationT = useTranslations('pagination');
  const locale = useLocale();
  const isArchivedTab = payload.tab === 'archived';
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );
  const pagination = createDataTablePagination({
    labels: {
      firstPageLabel: paginationT('firstPage'),
      itemLabel: paginationT('page'),
      lastPageLabel: paginationT('lastPage'),
      nextPageLabel: paginationT('nextPage'),
      ofLabel: paginationT('of'),
      pageSizeLabel: paginationT('itemsPerPage'),
      previousPageLabel: paginationT('previousPage'),
    },
    page: payload.pagination.page,
    pageSize: payload.pagination.pageSize,
    pageSizeOptions: [...PRAYER_REQUEST_PAGE_SIZE_OPTIONS],
    preserveParams: isArchivedTab ? { tab: 'archived' } : undefined,
    total: payload.pagination.total,
  });

  return (
    <CardList
      data={payload.items}
      emptyMessage={isArchivedTab ? t('emptyArchived') : t('emptyActive')}
      getCardKey={(request) => request.id}
      pagination={pagination}
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

  return (
    <>
      <div className="flex min-w-0 items-start gap-2">
        <button
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 border-0 bg-transparent p-0 text-left"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          <span
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--muted)] transition-transform"
          >
            <ChevronIcon expanded={expanded} />
          </span>
          <span className="grid min-w-0 gap-[3px]">
            <strong className="min-w-0">{request.title}</strong>
            <span
              className={
                expanded
                  ? 'whitespace-pre-line text-[var(--muted)]'
                  : 'line-clamp-2 text-[var(--muted)]'
              }
            >
              {request.description}
            </span>
          </span>
        </button>
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
