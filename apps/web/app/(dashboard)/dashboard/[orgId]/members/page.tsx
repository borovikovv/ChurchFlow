import { revalidatePath } from 'next/cache';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { CopyField } from '@/components/copy-field';
import type { InlineInvitationState } from '@/components/members/invite-app-user-form';
import type { RoleUpdateState } from '@/components/members/member-actions';
import { MembersManager } from './_components/members-manager';
import {
  confirmMemberPhotoAction,
  prepareMemberPhotoAction,
  updateMemberProfileAction,
} from './actions';
import type {
  ClaimMutationResult,
  InvitationMutationResult,
  MemberRelationship,
  MembersPayload,
  PendingInvitation,
} from './types';
import {
  organizationMembersAccessFilterSchema,
  type OrganizationMembersAccessFilter,
} from '@churchflow/shared';

function membersUrl(organizationId: string, params?: Record<string, string>): Route {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  return `/dashboard/${organizationId}/members${query}` as Route;
}

async function manageInlineInvitation(
  previousState: InlineInvitationState,
  formData: FormData,
): Promise<InlineInvitationState> {
  'use server';
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
          message: 'Invitation revoked.',
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
        message: result.data.emailSent ? 'Invitation created and emailed.' : 'Invitation created.',
        error: null,
      }
    : { ...previousState, error: result.error.message };
}

async function mutateAndRedirect(
  organizationId: string,
  path: string,
  init: RequestInit,
  successMessage: string,
) {
  const result = await apiFetch(path, init);
  revalidatePath(`/dashboard/${organizationId}/members`);
  redirect(
    membersUrl(
      organizationId,
      result.ok ? { message: successMessage } : { error: result.error.message },
    ),
  );
}

async function claimAction(formData: FormData) {
  'use server';
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
        message: 'Access link refreshed.',
      }),
    );
  }
  redirect(membersUrl(organizationId, { message: `Claim ${action} completed.` }));
}

async function removeMember(formData: FormData) {
  'use server';
  const organizationId = String(formData.get('organizationId'));
  const membershipId = String(formData.get('membershipId'));
  await mutateAndRedirect(
    organizationId,
    `/organizations/${organizationId}/memberships/${membershipId}/remove`,
    { method: 'POST' },
    'Member removed.',
  );
}

async function createRelationship(formData: FormData) {
  'use server';
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
  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error.message };
}

async function deleteRelationship(formData: FormData) {
  'use server';
  const organizationId = String(formData.get('organizationId'));
  const result = await apiFetch(
    `/organizations/${organizationId}/memberships/relationships/${String(formData.get('relationshipId'))}`,
    { method: 'DELETE' },
  );
  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error.message };
}

async function updateMemberRole(
  previousState: RoleUpdateState,
  formData: FormData,
): Promise<RoleUpdateState> {
  'use server';
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

export default async function MembersDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ claimLink?: string; message?: string; error?: string; access?: string }>;
}) {
  const { orgId } = await params;
  const { claimLink, message, error, access = 'all' } = await searchParams;
  const parsedAccess = organizationMembersAccessFilterSchema.safeParse(access);
  const memberAccess: OrganizationMembersAccessFilter = parsedAccess.success
    ? parsedAccess.data
    : 'all';
  const result = await apiFetch<MembersPayload>(
    `/organizations/${orgId}/memberships?${new URLSearchParams({ access: memberAccess })}`,
  );
  const payload: MembersPayload = result.ok
    ? result.data
    : { actorRole: null, actorMembershipId: null, members: [], pendingInvitations: [] };
  if (result.ok) {
    await Promise.all(
      payload.members.map(async (member) => {
        if (!member.profile.profilePhotoAssetId) return;
        const photo = await apiFetch<{ url: string }>(
          `/organizations/${orgId}/media/${member.profile.profilePhotoAssetId}/read-url`,
        );
        if (photo.ok) member.profile.photoUrl = photo.data.url;
      }),
    );
  }
  const canManage = payload.actorRole === 'OWNER' || payload.actorRole === 'ADMIN';
  if (canManage) {
    await Promise.all(
      payload.members.map(async (member) => {
        const relationships = await apiFetch<MemberRelationship[]>(
          `/organizations/${orgId}/memberships/${member.id}/relationships`,
        );
        member.relationships = relationships.ok ? relationships.data : [];
      }),
    );
  }

  return (
    <div className="stack">
      <h1>Members</h1>
      <p>Your role: {payload.actorRole ?? 'Platform administrator'}</p>
      {!result.ok ? <p className="form-error">{result.error.message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      {claimLink ? <CopyField value={claimLink} /> : null}

      <MembersManager
        organizationId={orgId}
        initialMembers={payload.members}
        actorMembershipId={payload.actorMembershipId}
        actorRole={payload.actorRole}
        manageInvitation={manageInlineInvitation}
        updateProfile={updateMemberProfileAction}
        updateRole={updateMemberRole}
        removeMember={removeMember}
        claimAction={claimAction}
        createRelationship={createRelationship}
        deleteRelationship={deleteRelationship}
        preparePhoto={prepareMemberPhotoAction}
        confirmPhoto={confirmMemberPhotoAction}
        tabs={[
          { label: 'All', href: membersUrl(orgId), active: memberAccess === 'all' },
          {
            label: 'Telegram connected',
            href: membersUrl(orgId, { access: 'connected' }),
            active: memberAccess === 'connected',
          },
          {
            label: 'No app access',
            href: membersUrl(orgId, { access: 'offline' }),
            active: memberAccess === 'offline',
          },
          {
            label: 'Access requested',
            href: membersUrl(orgId, { access: 'requested' }),
            active: memberAccess === 'requested',
          },
          {
            label: 'Suspended',
            href: membersUrl(orgId, { access: 'suspended' }),
            active: memberAccess === 'suspended',
          },
        ]}
      />
    </div>
  );
}
