'use server';

import type { MembershipClaimMutationResult } from '@churchflow/shared';
import { apiFetch } from '@/api/client';
import type { MemberAccessActionState } from './member-access.types';

export async function manageMemberAccess(
  previousState: MemberAccessActionState,
  formData: FormData,
): Promise<MemberAccessActionState> {
  const organizationId = String(formData.get('organizationId'));

  if (formData.get('intent') === 'revoke') {
    const claimId = String(formData.get('claimId') || previousState.claimId);
    const result = await apiFetch<{ status: string }>(
      `/organizations/${organizationId}/membership-claims/${claimId}/revoke`,
      { method: 'POST' },
    );

    return result.ok
      ? {
          claimId: null,
          claimUrl: null,
          message: 'App access link revoked.',
          error: null,
        }
      : { ...previousState, error: result.error.message };
  }

  const membershipId = String(formData.get('membershipId'));
  const result = await apiFetch<MembershipClaimMutationResult>(
    `/organizations/${organizationId}/memberships/${membershipId}/claim`,
    { method: 'POST' },
  );

  return result.ok
    ? {
        claimId: result.data.claim.id,
        claimUrl: result.data.claimUrl,
        message: result.data.emailSent
          ? 'Access link created and emailed to this member.'
          : 'Access link created. Copy and share it with this member.',
        error: null,
      }
    : { ...previousState, error: result.error.message };
}
