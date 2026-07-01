'use server';

import type {
  ApiResult,
  DeleteOrganizationRequestResult,
  ResubmitOrganizationRequestResult,
} from '@churchflow/shared';
import { apiFetch } from '@/api/client';

export async function resubmitOrganizationRequest(
  requestId: string,
): Promise<ApiResult<ResubmitOrganizationRequestResult>> {
  return apiFetch<ResubmitOrganizationRequestResult>(
    `/organization-requests/${requestId}/resubmit`,
    { method: 'POST' },
  );
}

export async function deleteOrganizationRequest(
  requestId: string,
): Promise<ApiResult<DeleteOrganizationRequestResult>> {
  return apiFetch<DeleteOrganizationRequestResult>(`/organization-requests/${requestId}`, {
    method: 'DELETE',
  });
}
