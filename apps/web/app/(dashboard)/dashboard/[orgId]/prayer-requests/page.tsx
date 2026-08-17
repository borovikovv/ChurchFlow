import { apiFetch } from '@/api/client';
import { getCurrentUser } from '@/auth/session';
import { getMessages } from '@/i18n/messages';
import type { PrayerRequestsPayload } from '@churchflow/shared';
import { listPrayerRequestsQuerySchema } from '@churchflow/shared';
import {
  archivePrayerRequestAction,
  createPrayerRequestAction,
  deletePrayerRequestAction,
  loadPrayerRequestsAction,
  restorePrayerRequestAction,
  updatePrayerRequestAction,
} from './actions';
import { PrayerRequestsManager } from './_components/prayer-requests-manager';
import styles from './_components/prayer-requests-manager.module.css';
import { createEmptyPrayerRequestsPayload } from './prayer-requests-payload';

export default async function PrayerRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ tab?: string; page?: string; pageSize?: string }>;
}) {
  const { orgId } = await params;
  const query = listPrayerRequestsQuerySchema.parse(await searchParams);
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? 'en');
  const requestQuery = new URLSearchParams({
    tab: query.tab,
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  const result = await apiFetch<PrayerRequestsPayload>(
    `/organizations/${orgId}/prayer-requests?${requestQuery}`,
  );
  const payload = result.ok ? result.data : createEmptyPrayerRequestsPayload(query);

  return (
    <div className={`${styles['page'] ?? ''} stack`}>
      <h1>{messages.prayerRequests.title}</h1>
      {!result.ok ? <p className="form-error">{result.error.message}</p> : null}
      <PrayerRequestsManager
        key={`${payload.tab}:${payload.pagination.page}:${payload.pagination.pageSize}`}
        organizationId={orgId}
        initialPayload={payload}
        createRequest={createPrayerRequestAction}
        loadRequests={loadPrayerRequestsAction}
        updateRequest={updatePrayerRequestAction}
        archiveRequest={archivePrayerRequestAction}
        restoreRequest={restorePrayerRequestAction}
        deleteRequest={deletePrayerRequestAction}
      />
    </div>
  );
}
