import { revalidatePath } from 'next/cache';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { getCurrentUser } from '@/auth/session';
import { CopyField } from '@/components/copy-field';
import type { InlineInvitationState } from '@/components/members/invite-app-user-form';
import type { RoleUpdateState } from '@/components/members/member-actions';
import { getMessages } from '@/i18n/messages';
import { MembersManager } from './_components/members-manager';
import {
  confirmMemberPhotoAction,
  loadMembersAction,
  prepareMemberPhotoAction,
  updateMemberProfileAction,
} from './actions';
import type {
  ClaimMutationResult,
  InvitationMutationResult,
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

async function claimAction(formData: FormData) {
  'use server';
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

async function removeMember(formData: FormData) {
  'use server';
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
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? 'en');
  const parsedAccess = organizationMembersAccessFilterSchema.safeParse(access);
  const memberAccess: OrganizationMembersAccessFilter = parsedAccess.success
    ? parsedAccess.data
    : 'all';
  const membersResult = await loadMembersAction({ organizationId: orgId, access: memberAccess });
  const payload: MembersPayload = membersResult.ok
    ? membersResult.payload
    : { actorRole: null, actorMembershipId: null, members: [], pendingInvitations: [] };

  return (
    <div className="stack">
      <h1>{messages.members.title}</h1>
      <p>
        {messages.members.yourRole.replace(
          '{role}',
          payload.actorRole
            ? messages.members.roleLabels[payload.actorRole]
            : messages.members.platformAdministrator,
        )}
      </p>
      {!membersResult.ok ? <p className="form-error">{membersResult.error}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      {claimLink ? <CopyField value={claimLink} /> : null}

      <MembersManager
        key={memberAccess}
        memberAccess={memberAccess}
        organizationId={orgId}
        initialPayload={payload}
        manageInvitation={manageInlineInvitation}
        updateProfile={updateMemberProfileAction}
        updateRole={updateMemberRole}
        removeMember={removeMember}
        claimAction={claimAction}
        createRelationship={createRelationship}
        deleteRelationship={deleteRelationship}
        preparePhoto={prepareMemberPhotoAction}
        confirmPhoto={confirmMemberPhotoAction}
      />
    </div>
  );
}

async function getCurrentUserMessages() {
  const user = await getCurrentUser();
  return getMessages(user?.locale ?? 'en');
}
