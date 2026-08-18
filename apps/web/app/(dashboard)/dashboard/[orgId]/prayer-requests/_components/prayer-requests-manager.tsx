'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import type {
  ArchivePrayerRequestInput,
  CreatePrayerRequestInput,
  PrayerRequestItem,
  PrayerRequestsPayload,
  PrayerRequestTab,
  UpdatePrayerRequestInput,
} from '@churchflow/shared';
import { Tabs } from '@/components/ui/tabs';
import { organizationPrayerRequestsRoute } from '@/features/organizations/routes';
import { PrayerRequestFormDialog } from './prayer-request-form-dialog';
import { PrayerRequestsTable } from './prayer-requests-table';
import styles from './prayer-requests-manager.module.css';

type MutationResult<T> = { ok: true; request: T } | { ok: false; error: string };
type DeleteResult = { ok: true; deletedRequestId: string } | { ok: false; error: string };
type LoadResult = { ok: true; payload: PrayerRequestsPayload } | { ok: false; error: string };

export function PrayerRequestsManager({
  organizationId,
  initialPayload,
  createRequest,
  loadRequests,
  updateRequest,
  archiveRequest,
  restoreRequest,
  deleteRequest,
}: {
  organizationId: string;
  initialPayload: PrayerRequestsPayload;
  createRequest: (input: {
    organizationId: string;
    request: CreatePrayerRequestInput;
  }) => Promise<MutationResult<PrayerRequestItem>>;
  loadRequests: (input: {
    organizationId: string;
    tab: PrayerRequestTab;
    page: number;
    pageSize: number;
  }) => Promise<LoadResult>;
  updateRequest: (input: {
    organizationId: string;
    requestId: string;
    request: UpdatePrayerRequestInput;
  }) => Promise<MutationResult<PrayerRequestItem>>;
  archiveRequest: (input: {
    organizationId: string;
    requestId: string;
    request: ArchivePrayerRequestInput;
  }) => Promise<MutationResult<PrayerRequestItem>>;
  restoreRequest: (input: {
    organizationId: string;
    requestId: string;
  }) => Promise<MutationResult<PrayerRequestItem>>;
  deleteRequest: (input: { organizationId: string; requestId: string }) => Promise<DeleteResult>;
}) {
  const t = useTranslations('prayerRequests');
  const [payload, setPayload] = useState(initialPayload);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeHref = organizationPrayerRequestsRoute(organizationId);
  const archivedHref = `${activeHref}?tab=archived`;

  function mutate(promise: Promise<MutationResult<PrayerRequestItem>>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await promise;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess?.();
      await refreshPayload();
    });
  }

  async function refreshPayload() {
    const result = await loadRequests({
      organizationId,
      tab: payload.tab,
      page: payload.pagination.page,
      pageSize: payload.pagination.pageSize,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPayload(result.payload);
  }

  return (
    <section className={cx(styles['manager'], 'stack min-w-0')}>
      <div className="flex min-w-0 flex-col justify-between gap-3 md:flex-row md:items-start">
        <Tabs
          label={t('tabsLabel')}
          items={[
            {
              label: t('active'),
              href: activeHref,
              active: payload.tab === 'active',
              count: payload.counts.active,
            },
            {
              label: t('archived'),
              href: archivedHref,
              active: payload.tab === 'archived',
              count: payload.counts.archived,
            },
          ]}
        />
        <PrayerRequestFormDialog
          title={t('createTitle')}
          triggerLabel={t('create')}
          submitLabel={t('publish')}
          onSubmit={(request, closeDialog) => {
            mutate(createRequest({ organizationId, request }), () => {
              closeDialog();
            });
          }}
        />
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <PrayerRequestsTable
        disabled={isPending}
        payload={payload}
        onUpdate={(requestId, request) => {
          mutate(updateRequest({ organizationId, requestId, request }));
        }}
        onArchive={(requestId, request) => {
          mutate(archiveRequest({ organizationId, requestId, request }));
        }}
        onRestore={(requestId) => {
          mutate(restoreRequest({ organizationId, requestId }));
        }}
        onDelete={async (request) => {
          setError(null);
          const result = await deleteRequest({ organizationId, requestId: request.id });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          await refreshPayload();
        }}
      />
    </section>
  );
}

function cx(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
