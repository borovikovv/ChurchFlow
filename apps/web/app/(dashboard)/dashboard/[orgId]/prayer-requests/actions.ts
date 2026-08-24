'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/api/client';
import type {
  ArchivePrayerRequestInput,
  CreatePrayerRequestInput,
  PrayerRequestItem,
  PrayerRequestsPayload,
  PrayerRequestTab,
  UpdatePrayerRequestInput,
} from '@churchflow/shared';
import { listPrayerRequestsQuerySchema } from '@churchflow/shared';

function prayerRequestsPath(organizationId: string) {
  return `/dashboard/${organizationId}/prayer-requests`;
}

export async function loadPrayerRequestsAction(input: {
  organizationId: string;
  tab: PrayerRequestTab;
  cursor?: string;
  page: number;
  pageSize: number;
}) {
  const parsedQuery = listPrayerRequestsQuerySchema.safeParse({
    tab: input.tab,
    page: input.page,
    pageSize: input.pageSize,
    ...(input.cursor ? { cursor: input.cursor } : {}),
  });
  if (!parsedQuery.success) return { ok: false as const, error: 'Invalid filters.' };

  const query = new URLSearchParams({
    tab: parsedQuery.data.tab,
    page: String(parsedQuery.data.page),
    pageSize: String(parsedQuery.data.pageSize),
  });
  if (parsedQuery.data.cursor) {
    query.set('cursor', parsedQuery.data.cursor);
  }
  const result = await apiFetch<PrayerRequestsPayload>(
    `/organizations/${input.organizationId}/prayer-requests?${query}`,
  );

  return result.ok
    ? { ok: true as const, payload: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function createPrayerRequestAction(input: {
  organizationId: string;
  request: CreatePrayerRequestInput;
}) {
  const result = await apiFetch<PrayerRequestItem>(
    `/organizations/${input.organizationId}/prayer-requests`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input.request),
    },
  );
  revalidatePath(prayerRequestsPath(input.organizationId));

  return result.ok
    ? { ok: true as const, request: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function updatePrayerRequestAction(input: {
  organizationId: string;
  requestId: string;
  request: UpdatePrayerRequestInput;
}) {
  const result = await apiFetch<PrayerRequestItem>(
    `/organizations/${input.organizationId}/prayer-requests/${input.requestId}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input.request),
    },
  );
  revalidatePath(prayerRequestsPath(input.organizationId));

  return result.ok
    ? { ok: true as const, request: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function archivePrayerRequestAction(input: {
  organizationId: string;
  requestId: string;
  request: ArchivePrayerRequestInput;
}) {
  const result = await apiFetch<PrayerRequestItem>(
    `/organizations/${input.organizationId}/prayer-requests/${input.requestId}/archive`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input.request),
    },
  );
  revalidatePath(prayerRequestsPath(input.organizationId));

  return result.ok
    ? { ok: true as const, request: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function restorePrayerRequestAction(input: {
  organizationId: string;
  requestId: string;
}) {
  const result = await apiFetch<PrayerRequestItem>(
    `/organizations/${input.organizationId}/prayer-requests/${input.requestId}/restore`,
    { method: 'POST' },
  );
  revalidatePath(prayerRequestsPath(input.organizationId));

  return result.ok
    ? { ok: true as const, request: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function deletePrayerRequestAction(input: {
  organizationId: string;
  requestId: string;
}) {
  const result = await apiFetch<{ id: string }>(
    `/organizations/${input.organizationId}/prayer-requests/${input.requestId}`,
    { method: 'DELETE' },
  );
  revalidatePath(prayerRequestsPath(input.organizationId));

  return result.ok
    ? { ok: true as const, deletedRequestId: result.data.id }
    : { ok: false as const, error: result.error.message };
}
