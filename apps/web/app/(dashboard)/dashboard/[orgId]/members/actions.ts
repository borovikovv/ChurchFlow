'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/api/client';
import type {
  CreateManualOrganizationMemberInput,
  ImportOrganizationMembersCsvResult,
  MemberMinistry,
  OrganizationMembersAccessFilter,
} from '@churchflow/shared';
import type { ProfileUpdateState } from '@/components/members/member-actions';
import type { MemberRelationship, MembersPayload } from './types';

export async function loadMembersAction(input: {
  organizationId: string;
  access: OrganizationMembersAccessFilter;
}) {
  const result = await apiFetch<MembersPayload>(
    `/organizations/${input.organizationId}/memberships?${new URLSearchParams({ access: input.access })}`,
  );
  if (!result.ok) return { ok: false as const, error: result.error.message };

  const payload = result.data;
  await Promise.all(
    payload.members.map(async (member) => {
      if (!member.profile.profilePhotoAssetId) return;
      const photo = await apiFetch<{ url: string }>(
        `/organizations/${input.organizationId}/media/${member.profile.profilePhotoAssetId}/read-url`,
      );
      if (photo.ok) member.profile.photoUrl = photo.data.url;
    }),
  );

  const canManage = payload.actorRole === 'OWNER' || payload.actorRole === 'ADMIN';
  if (canManage) {
    await Promise.all(
      payload.members.map(async (member) => {
        const relationships = await apiFetch<MemberRelationship[]>(
          `/organizations/${input.organizationId}/memberships/${member.id}/relationships`,
        );
        member.relationships = relationships.ok ? relationships.data : [];
      }),
    );
  }

  return { ok: true as const, payload };
}

export async function createMemberAction(input: {
  organizationId: string;
  member: CreateManualOrganizationMemberInput;
  prepareAccess: boolean;
}) {
  const created = await apiFetch<{
    id: string;
    role: string;
    source: string;
    ministries: MemberMinistry[];
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

export async function importMembersCsvAction(formData: FormData) {
  const organizationId = String(formData.get('organizationId'));
  const file = formData.get('file');

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: 'Choose a CSV file to import.' };
  }

  const upload = new FormData();
  upload.append('file', file);

  const result = await apiFetch<ImportOrganizationMembersCsvResult>(
    `/organizations/${organizationId}/memberships/import-csv`,
    {
      method: 'POST',
      body: upload,
    },
  );

  if (!result.ok) return { ok: false as const, error: result.error.message };

  revalidatePath(`/dashboard/${organizationId}/members`);
  return { ok: true as const, result: result.data };
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
        ministries: formData.getAll('ministries'),
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
