'use server';

import { revalidatePath } from 'next/cache';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { getCurrentUser } from '@/auth/session';
import type { InlineInvitationState } from '@/components/members/invite-app-user-form';
import type {
  CreateManualOrganizationMemberInput,
  ImportOrganizationMembersCsvResult,
  MemberMinistry,
  OrganizationMembersAccessFilter,
} from '@churchflow/shared';
import type { ProfileUpdateState, RoleUpdateState } from '@/components/members/member-actions';
import { getMessages } from '@/i18n/messages';
import type {
  ClaimMutationResult,
  InvitationMutationResult,
  MemberRelationship,
  MembersPayload,
  PendingInvitation,
} from './types';

function membersUrl(organizationId: string, params?: Record<string, string>): Route {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  return `/dashboard/${organizationId}/members${query}` as Route;
}

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
  await Promise.all(
    payload.members.map(async (member) => {
      if (!canManage && member.id !== payload.actorMembershipId) return;
      const relationships = await apiFetch<MemberRelationship[]>(
        `/organizations/${input.organizationId}/memberships/${member.id}/relationships`,
      );
      member.relationships = relationships.ok ? relationships.data : [];
    }),
  );

  return { ok: true as const, payload };
}

export async function loadMemberDetailsAction(input: {
  organizationId: string;
  membershipId: string;
}) {
  const membersResult = await loadMembersAction({
    organizationId: input.organizationId,
    access: 'all',
  });
  if (!membersResult.ok) return membersResult;

  const member = membersResult.payload.members.find(({ id }) => id === input.membershipId);
  if (!member) {
    return { ok: false as const, error: 'Organization member was not found.' };
  }

  return { ok: true as const, payload: membersResult.payload, member };
}

export async function manageInlineInvitationAction(
  previousState: InlineInvitationState,
  formData: FormData,
): Promise<InlineInvitationState> {
  const messages = await getCurrentUserMessages();
  const organizationId = String(formData.get('organizationId'));

  if (formData.get('intent') === 'revoke') {
    const invitationId = String(formData.get('invitationId') || previousState.invitationId);
    const result = await apiFetch<PendingInvitation>(
      `/organizations/${organizationId}/invitations/${invitationId}/revoke`,
      { method: 'POST' },
    );

    return result.ok
      ? {
          invitationId: null,
          inviteUrl: null,
          message: messages.members.invitationRevoked,
          error: null,
        }
      : { ...previousState, error: result.error.message };
  }

  const result = await apiFetch<InvitationMutationResult>(
    `/organizations/${organizationId}/invitations`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'claimable_link',
        email: formData.get('notificationEmail') || undefined,
        role: formData.get('role'),
      }),
    },
  );

  return result.ok
    ? {
        invitationId: result.data.invitation.id,
        inviteUrl: result.data.acceptUrl,
        message: result.data.emailSent
          ? messages.members.invitationCreatedAndEmailed
          : messages.members.invitationCreated,
        error: null,
      }
    : { ...previousState, error: result.error.message };
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

export async function claimAction(formData: FormData) {
  const messages = await getCurrentUserMessages();
  const organizationId = String(formData.get('organizationId'));
  const claimId = String(formData.get('claimId'));
  const action = String(formData.get('action'));
  const result = await apiFetch<ClaimMutationResult | { status: string }>(
    `/organizations/${organizationId}/membership-claims/${claimId}/${action}`,
    { method: 'POST' },
  );
  revalidatePath(`/dashboard/${organizationId}/members`);
  if (!result.ok) redirect(membersUrl(organizationId, { error: result.error.message }));
  if ('claimUrl' in result.data) {
    redirect(
      membersUrl(organizationId, {
        claimLink: result.data.claimUrl,
        message: messages.members.accessLinkRefreshed,
      }),
    );
  }
  redirect(
    membersUrl(organizationId, {
      message: messages.members.claimActionCompleted.replace('{action}', action),
    }),
  );
}

export async function removeMemberAction(formData: FormData) {
  const organizationId = String(formData.get('organizationId'));
  const membershipId = String(formData.get('membershipId'));
  const result = await apiFetch(
    `/organizations/${organizationId}/memberships/${membershipId}/remove`,
    { method: 'POST' },
  );
  if (result.ok) {
    revalidatePath(`/dashboard/${organizationId}/members`);
    return { ok: true as const };
  }

  return { ok: false as const, error: result.error.message };
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

export async function updateMemberRoleAction(
  previousState: RoleUpdateState,
  formData: FormData,
): Promise<RoleUpdateState> {
  const organizationId = String(formData.get('organizationId'));
  const membershipId = String(formData.get('membershipId'));
  const role = String(formData.get('role')) as RoleUpdateState['role'];
  const result = await apiFetch(
    `/organizations/${organizationId}/memberships/${membershipId}/role`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role }),
    },
  );

  return result.ok
    ? { role, updated: true, version: previousState.version + 1, error: null }
    : { ...previousState, updated: false, error: result.error.message };
}

export async function createRelationshipAction(formData: FormData) {
  const organizationId = String(formData.get('organizationId'));
  const membershipId = String(formData.get('membershipId'));
  const result = await apiFetch(
    `/organizations/${organizationId}/memberships/${membershipId}/relationships`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        relatedMembershipId: formData.get('relatedMembershipId'),
        type: formData.get('relationshipType'),
      }),
    },
  );
  if (!result.ok) return { ok: false as const, error: result.error.message };

  const relationships = await apiFetch<MemberRelationship[]>(
    `/organizations/${organizationId}/memberships/${membershipId}/relationships`,
  );

  return relationships.ok
    ? { ok: true as const, relationships: relationships.data }
    : { ok: false as const, error: relationships.error.message };
}

export async function deleteRelationshipAction(formData: FormData) {
  const organizationId = String(formData.get('organizationId'));
  const result = await apiFetch(
    `/organizations/${organizationId}/memberships/relationships/${String(formData.get('relationshipId'))}`,
    { method: 'DELETE' },
  );
  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error.message };
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

async function getCurrentUserMessages() {
  const user = await getCurrentUser();
  return getMessages(user?.locale ?? 'en');
}
