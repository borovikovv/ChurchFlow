import { revalidatePath } from 'next/cache';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { CopyField } from '@/components/copy-field';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';

type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

interface OrganizationMember {
  id: string;
  role: OrganizationRole;
  user: {
    email: string | null;
    displayName: string | null;
  };
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

function membersUrl(organizationId: string, params?: Record<string, string>): Route {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  return `/dashboard/${organizationId}/members${query}` as Route;
}

async function createClaimableInvitation(formData: FormData) {
  'use server';
  const organizationId = String(formData.get('organizationId'));
  const result = await apiFetch<InvitationMutationResult>(
    `/organizations/${organizationId}/invitations`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'claimable_link',
        email: formData.get('notificationEmail'),
        role: formData.get('role'),
      }),
    },
  );
  revalidatePath(`/dashboard/${organizationId}/members`);

  if (!result.ok) {
    redirect(membersUrl(organizationId, { error: result.error.message }));
  }

  redirect(
    membersUrl(organizationId, {
      invitationLink: result.data.acceptUrl,
      message: result.data.emailSent ? 'Invitation created and emailed.' : 'Invitation created.',
    }),
  );
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

  if (!result.ok) {
    redirect(membersUrl(organizationId, { error: result.error.message }));
  }

  const data = result.data;
  if ('acceptUrl' in data) {
    redirect(
      membersUrl(organizationId, {
        invitationLink: data.acceptUrl,
        message: data.emailSent ? 'Invitation refreshed and emailed.' : 'Invitation refreshed.',
      }),
    );
  }

  redirect(membersUrl(organizationId, { message: 'Invitation revoked.' }));
}

async function removeMember(formData: FormData) {
  'use server';
  const organizationId = String(formData.get('organizationId'));
  const membershipId = String(formData.get('membershipId'));
  const result = await apiFetch(
    `/organizations/${organizationId}/memberships/${membershipId}/remove`,
    { method: 'POST' },
  );
  revalidatePath(`/dashboard/${organizationId}/members`);

  redirect(
    membersUrl(
      organizationId,
      result.ok ? { message: 'Member removed.' } : { error: result.error.message },
    ),
  );
}

async function updateMemberRole(formData: FormData) {
  'use server';
  const organizationId = String(formData.get('organizationId'));
  const membershipId = String(formData.get('membershipId'));
  const result = await apiFetch(
    `/organizations/${organizationId}/memberships/${membershipId}/role`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: formData.get('role') }),
    },
  );
  revalidatePath(`/dashboard/${organizationId}/members`);

  redirect(
    membersUrl(
      organizationId,
      result.ok ? { message: 'Member role updated.' } : { error: result.error.message },
    ),
  );
}

export default async function MembersDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ invitationLink?: string; message?: string; error?: string }>;
}) {
  const { orgId } = await params;
  const { invitationLink, message, error } = await searchParams;
  const result = await apiFetch<MembersPayload>(`/organizations/${orgId}/memberships`);
  const payload: MembersPayload = result.ok
    ? result.data
    : { actorRole: null, actorMembershipId: null, members: [], pendingInvitations: [] };
  const canInvite = payload.actorRole === 'OWNER' || payload.actorRole === 'ADMIN';
  const isOwner = payload.actorRole === 'OWNER';

  return (
    <div className="stack">
      <h1>Members</h1>
      <p>Your role: {payload.actorRole ?? 'Platform administrator'}</p>
      {!result.ok ? <p className="form-error">{result.error.message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      {invitationLink ? (
        <section className="form-grid">
          <label>Invitation link</label>
          <CopyField value={invitationLink} />
        </section>
      ) : null}

      {canInvite ? (
        <form className="form-grid compact" action={createClaimableInvitation}>
          <input type="hidden" name="organizationId" value={orgId} />
          <label>
            Notification email
            <input name="notificationEmail" type="email" maxLength={255} />
          </label>
          <label>
            Initial role
            <select name="role" defaultValue="MEMBER">
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </label>
          <button className="button" type="submit">
            Generate invitation link
          </button>
        </form>
      ) : null}

      <section className="stack">
        <h2>Active members</h2>
        <div className="data-list">
          {payload.members.map((member) => (
            <div className="row" key={member.id}>
              <strong>{member.user.displayName ?? member.user.email ?? 'Member'}</strong>
              <span>{member.user.email ?? 'No email'}</span>
              <span>{member.role}</span>
              {isOwner ? (
                <div className="actions inline">
                  <form action={updateMemberRole} className="actions inline">
                    <input type="hidden" name="organizationId" value={orgId} />
                    <input type="hidden" name="membershipId" value={member.id} />
                    <select name="role" defaultValue={member.role} aria-label="Member role">
                      <option value="OWNER">Owner</option>
                      <option value="ADMIN">Admin</option>
                      <option value="MEMBER">Member</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                    <ConfirmSubmitButton
                      confirmLabel="Change role"
                      description={`Apply the selected organization role to ${member.user.displayName ?? member.user.email ?? 'this member'}.`}
                      title="Change member role?"
                      triggerLabel="Update role"
                    />
                  </form>
                  {member.id !== payload.actorMembershipId ? (
                    <form action={removeMember}>
                      <input type="hidden" name="organizationId" value={orgId} />
                      <input type="hidden" name="membershipId" value={member.id} />
                      <ConfirmSubmitButton
                        confirmLabel="Remove member"
                        confirmVariant="danger"
                        description={`Remove ${member.user.displayName ?? member.user.email ?? 'this member'} from this organization. Their account will remain available.`}
                        title="Remove member?"
                        triggerLabel="Remove"
                        variant="danger"
                      />
                    </form>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {canInvite ? (
        <section className="stack">
          <h2>Pending invitations</h2>
          <div className="data-list">
            {payload.pendingInvitations.length === 0 ? <p>No active invitations.</p> : null}
            {payload.pendingInvitations.map((invitation) => (
              <form className="row" action={invitationAction} key={invitation.id}>
                <input type="hidden" name="organizationId" value={orgId} />
                <input type="hidden" name="invitationId" value={invitation.id} />
                <strong>{invitation.targetDisplay ?? invitation.email ?? 'Claimable link'}</strong>
                <span>{invitation.role}</span>
                <span>{new Date(invitation.expiresAt).toLocaleDateString()}</span>
                <div className="actions inline">
                  {invitation.email ? (
                    <button className="button secondary" name="action" value="resend" type="submit">
                      Resend
                    </button>
                  ) : null}
                  <ConfirmSubmitButton
                    confirmLabel="Revoke invitation"
                    confirmVariant="danger"
                    description="This invitation link will stop working immediately. You can create a new invitation later."
                    name="action"
                    title="Revoke invitation?"
                    triggerLabel="Revoke"
                    value="revoke"
                    variant="danger"
                  />
                </div>
              </form>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
