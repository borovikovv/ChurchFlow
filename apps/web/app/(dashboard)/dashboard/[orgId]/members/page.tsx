import { revalidatePath } from 'next/cache';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { CopyField } from '@/components/copy-field';
import {
  InviteAppUserForm,
  type InlineInvitationState,
} from '@/components/members/invite-app-user-form';
import {
  MemberActions,
  MemberRoleStatus,
  type RoleUpdateState,
} from '@/components/members/member-actions';
import { FormDialog } from '@/components/ui/form-dialog';
import { PhoneInputField } from '@/components/ui/phone-input-field';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs } from '@/components/ui/tabs';
import {
  organizationMembersAccessFilterSchema,
  type OrganizationMembersAccessFilter,
} from '@churchflow/shared';

type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
type AccountState =
  | 'UNCLAIMED'
  | 'CLAIM_PENDING'
  | 'CLAIM_REQUESTED'
  | 'CLAIMED'
  | 'ACCOUNT_DISABLED';

interface OrganizationMember {
  id: string;
  role: OrganizationRole;
  status: string;
  source: string;
  accountState: AccountState;
  claimedAt: string | null;
  profile: {
    displayName: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
  };
  user: { id: string; email: string | null; displayName: string | null } | null;
  activeClaim: {
    id: string;
    status: 'PENDING' | 'REQUESTED';
    expiresAt: string;
    requestedBy: { id: string; displayName: string | null; avatarUrl: string | null } | null;
  } | null;
}

interface PendingInvitation {
  id: string;
  mode: string;
  targetDisplay: string | null;
  email: string | null;
  role: string;
  expiresAt: string;
}

interface MembersPayload {
  actorRole: OrganizationRole | null;
  actorMembershipId: string | null;
  members: OrganizationMember[];
  pendingInvitations: PendingInvitation[];
}

interface InvitationMutationResult {
  invitation: PendingInvitation;
  acceptUrl: string;
  emailSent: boolean;
}

interface ClaimMutationResult {
  claim: { id: string };
  claimUrl: string;
  emailSent: boolean;
}

interface CreatedManualMember {
  id: string;
}

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

async function invitationAction(formData: FormData) {
  'use server';
  const organizationId = String(formData.get('organizationId'));
  const invitationId = String(formData.get('invitationId'));
  const action = String(formData.get('action'));
  const result = await apiFetch<InvitationMutationResult | PendingInvitation>(
    `/organizations/${organizationId}/invitations/${invitationId}/${action}`,
    { method: 'POST' },
  );
  revalidatePath(`/dashboard/${organizationId}/members`);
  if (!result.ok) redirect(membersUrl(organizationId, { error: result.error.message }));
  if ('acceptUrl' in result.data) {
    redirect(
      membersUrl(organizationId, {
        claimLink: result.data.acceptUrl,
        message: 'Invitation refreshed.',
      }),
    );
  }
  redirect(membersUrl(organizationId, { message: 'Invitation revoked.' }));
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

async function createManualMember(formData: FormData) {
  'use server';
  const organizationId = String(formData.get('organizationId'));
  const result = await apiFetch<CreatedManualMember>(
    `/organizations/${organizationId}/memberships/manual`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: formData.get('displayName'),
        email: formData.get('email') || null,
        phone: formData.get('phone') || null,
        notes: formData.get('notes') || null,
        role: formData.get('role'),
      }),
    },
  );
  revalidatePath(`/dashboard/${organizationId}/members`);
  if (!result.ok) {
    redirect(membersUrl(organizationId, { error: result.error.message }));
  }

  if (formData.get('prepareAccess') === 'on') {
    const claim = await apiFetch<ClaimMutationResult>(
      `/organizations/${organizationId}/memberships/${result.data.id}/claim`,
      { method: 'POST' },
    );
    if (!claim.ok) {
      redirect(
        membersUrl(organizationId, {
          error: `Member was created, but access could not be prepared: ${claim.error.message}`,
        }),
      );
    }
    redirect(
      membersUrl(organizationId, {
        claimLink: claim.data.claimUrl,
        message: claim.data.emailSent
          ? 'Member added; access link created and emailed.'
          : 'Member added; access link created.',
      }),
    );
  }

  redirect(membersUrl(organizationId, { message: 'Manual member added.' }));
}

async function updateProfile(formData: FormData) {
  'use server';
  const organizationId = String(formData.get('organizationId'));
  const membershipId = String(formData.get('membershipId'));
  await mutateAndRedirect(
    organizationId,
    `/organizations/${organizationId}/memberships/${membershipId}/profile`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: formData.get('displayName'),
        email: formData.get('email') || null,
        phone: formData.get('phone') || null,
        notes: formData.get('notes') || null,
      }),
    },
    'Member profile updated.',
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
  const canManage = payload.actorRole === 'OWNER' || payload.actorRole === 'ADMIN';
  const isOwner = payload.actorRole === 'OWNER';

  return (
    <div className="stack">
      <h1>Members</h1>
      <p>Your role: {payload.actorRole ?? 'Platform administrator'}</p>
      {!result.ok ? <p className="form-error">{result.error.message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      {claimLink ? <CopyField value={claimLink} /> : null}

      <div className="flex flex-col items-stretch gap-4 border-b border-[var(--line)] md:flex-row md:items-end md:justify-between [&_.ui-tabs]:flex-1 [&_.ui-tabs]:border-b-0">
        <Tabs
          label="Member access filters"
          items={[
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
        {canManage ? (
          <div className="flex shrink-0 justify-end gap-2 pb-2">
            <FormDialog triggerLabel="Invite app user" title="Invite an app user">
              <p className="-mt-4 mb-0">
                Send an email invitation or generate a link you can share yourself.
              </p>
              <InviteAppUserForm organizationId={orgId} action={manageInlineInvitation} />
            </FormDialog>
            <FormDialog
              triggerLabel="Add new member"
              triggerVariant="primary"
              title="Add member manually"
            >
              <form className="grid gap-4" action={createManualMember}>
                <input type="hidden" name="organizationId" value={orgId} />
                <label>
                  Name
                  <input name="displayName" required maxLength={160} />
                </label>
                <label>
                  Email
                  <input name="email" type="email" maxLength={255} />
                </label>
                <label>
                  Phone
                  <PhoneInputField name="phone" />
                </label>
                <label>
                  Role
                  <select name="role" defaultValue="MEMBER">
                    <option value="MEMBER">Member</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </label>
                <label>
                  Notes
                  <textarea name="notes" maxLength={2000} />
                </label>
                <label className="flex items-center gap-2">
                  <input className="min-h-0 w-auto" name="prepareAccess" type="checkbox" />
                  Prepare app access after adding
                </label>
                <button className="button" type="submit">
                  Add member
                </button>
              </form>
            </FormDialog>
          </div>
        ) : null}
      </div>

      <section className="stack">
        <h2>Organization members</h2>
        <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <div
            className="hidden grid-cols-[minmax(180px,1.4fr)_minmax(180px,1.2fr)_minmax(150px,1fr)_100px_44px] items-center gap-4 border-b border-[var(--line-muted)] bg-[var(--surface-subtle)] px-4 py-[11px] text-xs font-semibold text-[var(--muted)] md:grid"
            aria-hidden="true"
          >
            <span>Member</span>
            <span>Contact</span>
            <span>Access</span>
            <span>Status</span>
            <span />
          </div>
          {payload.members.map((member) => (
            <article
              className="grid min-h-[68px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-[var(--line-muted)] px-4 py-[11px] last:border-b-0 md:grid-cols-[minmax(180px,1.4fr)_minmax(180px,1.2fr)_minmax(150px,1fr)_100px_44px] md:gap-4"
              key={member.id}
            >
              <div className="grid min-w-0 gap-[3px]">
                <strong>{member.profile.displayName}</strong>
                <span className="truncate text-[var(--muted)]">
                  {member.source === 'MANUAL' ? 'Added manually' : 'App member'}
                </span>
              </div>
              <span className="col-start-1 truncate text-[var(--muted)] md:col-auto">
                {member.profile.email ?? member.profile.phone ?? 'No contact information'}
              </span>
              <div className="col-start-1 grid min-w-0 gap-[3px] md:col-auto">
                <StatusBadge status={member.accountState} />
                {member.activeClaim?.status === 'REQUESTED' ? (
                  <small className="truncate text-[var(--muted)]">
                    Requested by {member.activeClaim.requestedBy?.displayName ?? 'Telegram user'}
                  </small>
                ) : null}
              </div>
              <div className="col-start-1 md:col-auto">
                <MemberRoleStatus membershipId={member.id} role={member.role} />
              </div>
              <MemberActions
                member={member}
                organizationId={orgId}
                canManage={canManage}
                isOwner={isOwner}
                isCurrentMember={member.id === payload.actorMembershipId}
                updateProfile={updateProfile}
                updateRole={updateMemberRole}
                removeMember={removeMember}
                claimAction={claimAction}
              />
            </article>
          ))}
          {payload.members.length === 0 ? (
            <p className="m-0 px-4 py-8 text-center">No members match this filter.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
