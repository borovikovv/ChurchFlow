'use client';

import type { ColumnDef, Row } from '@tanstack/react-table';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type {
  ArchivePrayerRequestInput,
  PrayerRequestItem,
  PrayerRequestsPayload,
  UpdatePrayerRequestInput,
} from '@churchflow/shared';
import { PRAYER_REQUEST_PAGE_SIZE_OPTIONS } from '@churchflow/shared';
import { DataTable } from '@/components/ui/data-table';
import { createDataTablePagination } from '@/components/ui/data-table-pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { PrayerRequestActions } from './prayer-request-actions';
import styles from './prayer-requests-manager.module.css';

export function PrayerRequestsTable({
  disabled,
  payload,
  onUpdate,
  onArchive,
  onRestore,
  onDelete,
}: {
  disabled: boolean;
  payload: PrayerRequestsPayload;
  onUpdate: (requestId: string, request: UpdatePrayerRequestInput) => void;
  onArchive: (requestId: string, request: ArchivePrayerRequestInput) => void;
  onRestore: (requestId: string) => void;
  onDelete: (request: PrayerRequestItem) => Promise<void>;
}) {
  const t = useTranslations('prayerRequests');
  const paginationT = useTranslations('pagination');
  const locale = useLocale();
  const isArchivedTab = payload.tab === 'archived';
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );
  const columns = useMemo<Array<ColumnDef<PrayerRequestItem>>>(() => {
    const requestColumn: ColumnDef<PrayerRequestItem> = {
      id: 'request',
      header: t('request'),
      accessorFn: (request) => request.title,
      cell: ({ row }) => <PrayerRequestSummaryCell row={row} />,
      meta: {
        headerClassName: cx(styles['highlightHeader'], styles['requestColumn']),
        cellClassName: styles['requestColumn'] ?? '',
      },
    };
    const archiveReasonColumn: ColumnDef<PrayerRequestItem> = {
      id: 'archiveReason',
      header: t('archiveReasonColumn'),
      accessorFn: (request) => request.archiveReason ?? '',
      cell: ({ row }) => (
        <ArchiveReasonCell reason={row.original.archiveReason} emptyLabel={t('noArchiveReason')} />
      ),
      meta: {
        headerClassName: cx(styles['highlightHeader'], styles['archiveReasonColumn']),
        cellClassName: styles['archiveReasonColumn'] ?? '',
      },
    };
    const trailingColumns: Array<ColumnDef<PrayerRequestItem>> = [
      {
        id: 'author',
        header: t('author'),
        accessorFn: (request) => request.author.displayName,
        cell: ({ row }) => row.original.author.displayName,
        meta: {
          headerClassName: styles['authorColumn'] ?? '',
          cellClassName: styles['authorColumn'] ?? '',
        },
      },
      {
        id: 'createdAt',
        header: t('createdAt'),
        accessorFn: (request) => request.createdAt,
        cell: ({ row }) => dateFormatter.format(new Date(row.original.createdAt)),
        meta: {
          headerClassName: styles['dateColumn'] ?? '',
          cellClassName: styles['dateColumn'] ?? '',
        },
      },
      {
        id: 'status',
        header: t('status'),
        accessorFn: (request) => request.archivedAt ?? 'active',
        cell: ({ row }) =>
          row.original.archivedAt ? (
            <StatusBadge status="archived" label={t('archived')} />
          ) : (
            <StatusBadge status="active" label={t('active')} />
          ),
        meta: {
          headerClassName: styles['statusColumn'] ?? '',
          cellClassName: styles['statusColumn'] ?? '',
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <PrayerRequestActions
            request={row.original}
            disabled={disabled}
            onUpdate={onUpdate}
            onArchive={onArchive}
            onRestore={onRestore}
            onDelete={onDelete}
          />
        ),
        meta: {
          headerClassName: 'w-11',
          cellClassName: 'w-11',
        },
      },
    ];

    return isArchivedTab
      ? [requestColumn, archiveReasonColumn, ...trailingColumns]
      : [requestColumn, ...trailingColumns];
  }, [dateFormatter, disabled, isArchivedTab, onArchive, onDelete, onRestore, onUpdate, t]);

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
    preserveParams: payload.tab === 'archived' ? { tab: 'archived' } : undefined,
    total: payload.pagination.total,
  });

  return (
    <DataTable
      columns={columns}
      data={payload.items}
      emptyMessage={payload.tab === 'active' ? t('emptyActive') : t('emptyArchived')}
      getRowCanExpand={() => true}
      renderExpandedRow={(row) => <ExpandedPrayerRequest row={row} />}
      pagination={pagination}
      shellClassName={styles['tableShell'] ?? ''}
      tableClassName={isArchivedTab ? 'min-w-[1080px]' : 'min-w-[860px]'}
    />
  );
}

function PrayerRequestSummaryCell({ row }: { row: Row<PrayerRequestItem> }) {
  return (
    <div className={styles['titleCell'] ?? ''}>
      <button
        className={styles['expandButton'] ?? ''}
        type="button"
        aria-expanded={row.getIsExpanded()}
        onClick={row.getToggleExpandedHandler()}
      >
        <span className={styles['chevron'] ?? ''} aria-hidden="true">
          <ChevronIcon expanded={row.getIsExpanded()} />
        </span>
        <span className={styles['summary'] ?? ''}>
          <span className={styles['summaryTitle'] ?? ''}>{row.original.title}</span>
          <span className={styles['summaryDescription'] ?? ''}>{row.original.description}</span>
        </span>
      </button>
    </div>
  );
}

function ExpandedPrayerRequest({ row }: { row: Row<PrayerRequestItem> }) {
  return (
    <div className={styles['expandedContent'] ?? ''}>
      <p>{row.original.description}</p>
    </div>
  );
}

function ArchiveReasonCell({ reason, emptyLabel }: { reason: string | null; emptyLabel: string }) {
  return (
    <div
      className={
        reason
          ? (styles['archiveReasonNote'] ?? '')
          : cx(styles['archiveReasonNote'], styles['archiveReasonNoteEmpty'])
      }
      title={reason ?? emptyLabel}
    >
      {reason ?? emptyLabel}
    </div>
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

function cx(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
