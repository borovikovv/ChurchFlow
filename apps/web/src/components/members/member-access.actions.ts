'use server';

import type { MembershipClaimMutationResult } from '@churchflow/shared';
import { apiFetch } from '@/api/client';
import { getCurrentUser } from '@/auth/session';
import { getMessages } from '@/i18n/messages';
import type { MemberAccessActionState } from './member-access.types';

export async function manageMemberAccess(
  previousState: MemberAccessActionState,
  formData: FormData,
): Promise<MemberAccessActionState> {
  const organizationId = String(formData.get('organizationId'));
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? 'en');

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
          expiresAt: null,
          message: messages.members.accessLinkRevoked,
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
        expiresAt: result.data.expiresAt,
        message: result.data.emailSent
          ? messages.members.accessLinkCreatedAndEmailed
          : messages.members.accessLinkCreated,
        error: null,
      }
    : { ...previousState, error: result.error.message };
}
