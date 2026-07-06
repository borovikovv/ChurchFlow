'use server';

import type {
  ApiResult,
  DeleteOrganizationRequestResult,
  ResubmitOrganizationRequestResult,
} from '@churchflow/shared';
import { apiFetch } from '@/api/client';

interface ResendOrganizationRequestNotificationResult {
  notificationSent: boolean;
}

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

export async function resendOrganizationRequestNotification(
  requestId: string,
): Promise<ApiResult<ResendOrganizationRequestNotificationResult>> {
  return apiFetch<ResendOrganizationRequestNotificationResult>(
    `/organization-requests/${requestId}/resend-notification`,
    { method: 'POST' },
  );
}
