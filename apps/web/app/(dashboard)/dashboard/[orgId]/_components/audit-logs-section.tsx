'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { AuditLogListItem, AuditLogsPage } from '@churchflow/shared';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { loadAuditLogsAction } from '../actions';
import {
  AUDIT_ACTION_KEYS,
  auditActionLabel,
  auditActorName,
  createAuditDateFormatter,
  auditMetadataSummary,
} from './audit-log-formatting';

export function AuditLogsSection({
  organizationId,
  initialItems,
  initialNextCursor,
}: {
  organizationId: string;
  initialItems: AuditLogListItem[];
  initialNextCursor: string | null;
}) {
  const locale = useLocale();
  const t = useTranslations('home');
  const auditActionLabels = Object.fromEntries(
    AUDIT_ACTION_KEYS.map((action) => [action, t(`auditActions.${action}`)]),
  );
  const auditDateFormatter = createAuditDateFormatter(locale);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['audit-logs', organizationId],
    queryFn: async ({ pageParam }) => {
      const result = await loadAuditLogsAction({ organizationId, cursor: pageParam });
      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.page;
    },
    initialData: {
      pages: [{ items: initialItems, nextCursor: initialNextCursor }],
      pageParams: [null],
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: AuditLogsPage) => lastPage.nextCursor ?? undefined,
    staleTime: 60_000,
  });

  async function loadMore() {
    const result = await fetchNextPage();
    if (result.isError) {
      toast.error(result.error.message);
    }
  }

  const items = data.pages.flatMap((page) => page.items);

  return (
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="m-0 text-xl">{t('auditLogs')}</h2>
        <p className="m-0 text-[var(--muted)]">{t('auditLogsDescription')}</p>
      </div>
      {items.length > 0 ? (
        <ol className="grid gap-0 md:grid-cols-2 md:gap-x-12">
          {items.map((log) => (
            <li className="grid grid-cols-[24px_1fr] gap-3 pb-4" key={log.id}>
              <div className="flex flex-col items-center justify-center">
                <span className="pt-1.5 h-3 w-3 rounded-full border-[3px] border-[var(--accent)] bg-[var(--surface)]" />
                <span className="h-full w-px bg-[var(--line)]" />
              </div>
              <div className="grid gap-1">
                <p className="m-0 text-sm">
                  {auditActionLabel(log.action, auditActionLabels)} {t('by')}{' '}
                  <strong className="text-[var(--accent)]">
                    {auditActorName(log, {
                      system: t('system'),
                      unknownActor: t('unknownActor'),
                    })}
                  </strong>
                </p>
                <p className="m-0 text-xs text-[var(--muted)]">
                  {auditDateFormatter.format(new Date(log.createdAt))}
                </p>
                <p className="m-0 text-xs text-[var(--muted)]">
                  {auditMetadataSummary(log, {
                    changedFields: (fields) => t('changedFields', { fields }),
                    metadataRole: (role) => t('metadataRole', { role }),
                    metadataStatus: (status) => t('metadataStatus', { status }),
                  })}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="m-0 text-[var(--muted)]">{t('noAuditLogs')}</p>
      )}
      {hasNextPage ? (
        <div>
          <Button type="button" onClick={loadMore} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? t('loading') : t('loadMore')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
