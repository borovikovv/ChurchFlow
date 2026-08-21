'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/api/client';
import type { AuditLogsPage, UpdateOrganizationInput } from '@churchflow/shared';
import type { OrganizationHomeApiResponse } from './types';

const jsonHeaders = { 'content-type': 'application/json' };

export async function loadAuditLogsAction(input: {
  organizationId: string;
  cursor?: string | null;
  entityType?: string | null;
}) {
  const params = new URLSearchParams({ limit: '10' });
  if (input.cursor) {
    params.set('cursor', input.cursor);
  }
  if (input.entityType) {
    params.set('entityType', input.entityType);
  }

  const result = await apiFetch<AuditLogsPage>(
    `/organizations/${input.organizationId}/audit-logs?${params.toString()}`,
  );

  return result.ok
    ? { ok: true as const, page: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function updateOrganizationAction(input: {
  organizationId: string;
  organization: UpdateOrganizationInput;
}) {
  const result = await apiFetch<OrganizationHomeApiResponse>(
    `/organizations/${input.organizationId}`,
    {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(input.organization),
    },
  );
  revalidatePath(`/dashboard/${input.organizationId}`);

  return result.ok
    ? { ok: true as const, organization: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function prepareOrganizationLogoAction(input: {
  organizationId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
}) {
  const result = await apiFetch<{ assetId: string; uploadUrl: string }>(
    `/organizations/${input.organizationId}/media/organization-logo/upload`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(input),
    },
  );

  return result.ok
    ? { ok: true as const, ...result.data }
    : { ok: false as const, error: result.error.message };
}

export async function confirmOrganizationLogoAction(input: {
  organizationId: string;
  assetId: string;
}) {
  const result = await apiFetch<{ assetId: string }>(
    `/organizations/${input.organizationId}/media/organization-logo/confirm`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ assetId: input.assetId }),
    },
  );
  if (!result.ok) return { ok: false as const, error: result.error.message };

  const readUrl = await apiFetch<{ url: string }>(
    `/organizations/${input.organizationId}/media/${input.assetId}/read-url`,
  );
  revalidatePath(`/dashboard/${input.organizationId}`);

  return readUrl.ok
    ? { ok: true as const, assetId: input.assetId, logoUrl: readUrl.data.url }
    : { ok: false as const, error: readUrl.error.message };
}
