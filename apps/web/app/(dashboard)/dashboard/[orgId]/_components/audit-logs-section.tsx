'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { AuditLogListItem, AuditLogsPage } from '@churchflow/shared';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { loadAuditLogsAction } from '../actions';
import {
  auditActionLabel,
  auditActorName,
  auditDateFormatter,
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
        <h2 className="m-0 text-xl">Audit Logs</h2>
        <p className="m-0 text-[var(--muted)]">View recent updates to this organization.</p>
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
                  {auditActionLabel(log.action)} by{' '}
                  <strong className="text-[var(--accent)]">{auditActorName(log)}</strong>
                </p>
                <p className="m-0 text-xs text-[var(--muted)]">
                  {auditDateFormatter.format(new Date(log.createdAt))}
                </p>
                <p className="m-0 text-xs text-[var(--muted)]">{auditMetadataSummary(log)}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="m-0 text-[var(--muted)]">No audit logs yet.</p>
      )}
      {hasNextPage ? (
        <div>
          <Button type="button" onClick={loadMore} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading…' : 'Load More'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
