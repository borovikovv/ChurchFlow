'use server';

import { apiFetch } from '@/api/client';
import type { CreateManualOrganizationMemberInput } from '@churchflow/shared';
import type { ProfileUpdateState } from '@/components/members/member-actions';

export async function createMemberAction(input: {
  organizationId: string;
  member: CreateManualOrganizationMemberInput;
  prepareAccess: boolean;
}) {
  const created = await apiFetch<{
    id: string;
    role: string;
    source: string;
    profile: {
      displayName: string;
      email: string | null;
      phone: string | null;
      birthday: string | null;
      anniversary: string | null;
    };
  }>(`/organizations/${input.organizationId}/memberships/manual`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input.member),
  });
  if (!created.ok) return { ok: false as const, error: created.error.message };

  if (input.prepareAccess) {
    const claim = await apiFetch<{ claimUrl: string; emailSent: boolean }>(
      `/organizations/${input.organizationId}/memberships/${created.data.id}/claim`,
      { method: 'POST' },
    );
    if (!claim.ok) {
      return {
        ok: false as const,
        error: `Member was created, but access could not be prepared: ${claim.error.message}`,
      };
    }
  }
  return { ok: true as const, member: created.data };
}

export async function updateMemberProfileAction(
  _previousState: ProfileUpdateState,
  formData: FormData,
): Promise<ProfileUpdateState> {
  const organizationId = String(formData.get('organizationId'));
  const membershipId = String(formData.get('membershipId'));
  const result = await apiFetch(
    `/organizations/${organizationId}/memberships/${membershipId}/profile`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: formData.get('displayName'),
        email: formData.get('email') || null,
        phone: formData.get('phone') || null,
        notes: formData.get('notes') || null,
        memberSince: formData.get('memberSince') || null,
        birthday: formData.get('birthday') || null,
        anniversary: formData.get('anniversary') || null,
        biography: formData.get('biography') || null,
        familyNotes: formData.get('familyNotes') || null,
      }),
    },
  );
  return result.ok
    ? { updated: true, error: null }
    : { updated: false, error: result.error.message };
}

export async function prepareMemberPhotoAction(input: {
  organizationId: string;
  membershipId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
}) {
  const result = await apiFetch<{ assetId: string; uploadUrl: string }>(
    `/organizations/${input.organizationId}/media/members/${input.membershipId}/photo-upload`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  return result.ok ? { ok: true, ...result.data } : { ok: false, error: result.error.message };
}

export async function confirmMemberPhotoAction(input: {
  organizationId: string;
  membershipId: string;
  assetId: string;
}) {
  const result = await apiFetch(
    `/organizations/${input.organizationId}/media/members/${input.membershipId}/photo-confirm`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assetId: input.assetId }),
    },
  );
  if (!result.ok) return { ok: false, error: result.error.message };
  const readUrl = await apiFetch<{ url: string }>(
    `/organizations/${input.organizationId}/media/${input.assetId}/read-url`,
  );
  return readUrl.ok
    ? { ok: true, assetId: input.assetId, photoUrl: readUrl.data.url }
    : { ok: false, error: readUrl.error.message };
}
