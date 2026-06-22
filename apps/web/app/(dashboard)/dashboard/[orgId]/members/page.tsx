import { revalidatePath } from 'next/cache';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/api/client';

interface OrganizationMember {
  id: string;
  role: string;
  user: {
    email: string | null;
    displayName: string | null;
  };
}

interface PendingInvitation {
  id: string;
  mode: string;
  targetProvider: string;
  targetProviderAccountId: string | null;
  targetDisplay: string | null;
  email: string | null;
  role: string;
  expiresAt: string;
}

interface MembersPayload {
  members: OrganizationMember[];
  pendingInvitations: PendingInvitation[];
}

interface CreateInvitationResult {
  invitation: PendingInvitation;
  acceptUrl: string;
  emailSent: boolean;
}

async function createClaimableInvitation(formData: FormData) {
  'use server';
  const organizationId = String(formData.get('organizationId'));
  const result = await apiFetch<CreateInvitationResult>(
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

  if (result.ok) {
    redirect(
      `/dashboard/${organizationId}/members?invitationLink=${encodeURIComponent(result.data.acceptUrl)}` as Route,
    );
  }
}

async function createTargetedInvitation(formData: FormData) {
  'use server';
  const organizationId = String(formData.get('organizationId'));
  const result = await apiFetch<CreateInvitationResult>(
    `/organizations/${organizationId}/invitations`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'targeted_telegram',
        targetProvider: 'telegram',
        targetProviderAccountId: formData.get('telegramId'),
        targetDisplay: formData.get('telegramUsername'),
        email: formData.get('notificationEmail'),
        role: formData.get('role'),
      }),
    },
  );
  revalidatePath(`/dashboard/${organizationId}/members`);

  if (result.ok) {
    redirect(
      `/dashboard/${organizationId}/members?invitationLink=${encodeURIComponent(result.data.acceptUrl)}` as Route,
    );
  }
}

async function invitationAction(formData: FormData) {
  'use server';
  const organizationId = String(formData.get('organizationId'));
  const invitationId = String(formData.get('invitationId'));
  const action = String(formData.get('action'));
  await apiFetch(`/organizations/${organizationId}/invitations/${invitationId}/${action}`, {
    method: 'POST',
  });
  revalidatePath(`/dashboard/${organizationId}/members`);
}

async function removeMember(formData: FormData) {
  'use server';
  const organizationId = String(formData.get('organizationId'));
  const membershipId = String(formData.get('membershipId'));
  await apiFetch(`/organizations/${organizationId}/memberships/${membershipId}/remove`, {
    method: 'POST',
  });
  revalidatePath(`/dashboard/${organizationId}/members`);
}

export default async function MembersDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ invitationLink?: string }>;
}) {
  const { orgId } = await params;
  const { invitationLink } = await searchParams;
  const result = await apiFetch<MembersPayload>(`/organizations/${orgId}/memberships`);
  const payload = result.ok ? result.data : { members: [], pendingInvitations: [] };

  return (
    <div className="stack">
      <h1>Members</h1>
      {invitationLink ? (
        <section className="form-grid">
          <label>
            Invitation link
            <input readOnly value={invitationLink} />
          </label>
        </section>
      ) : null}
      <form className="form-grid compact" action={createClaimableInvitation}>
        <input type="hidden" name="organizationId" value={orgId} />
        <label>
          Notification email
          <input name="notificationEmail" type="email" maxLength={255} />
        </label>
        <label>
          Role
          <select name="role" defaultValue="MEMBER">
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </label>
        <button className="button" type="submit">
          Generate claimable link
        </button>
      </form>
      <form className="form-grid compact" action={createTargetedInvitation}>
        <input type="hidden" name="organizationId" value={orgId} />
        <label>
          Known Telegram provider account id
          <input name="telegramId" required maxLength={128} />
        </label>
        <label>
          Telegram username or display
          <input name="telegramUsername" maxLength={255} placeholder="@username" />
        </label>
        <label>
          Notification email
          <input name="notificationEmail" type="email" maxLength={255} />
        </label>
        <label>
          Role
          <select name="role" defaultValue="ADMIN">
            <option value="ADMIN">Admin</option>
            <option value="OWNER">Owner</option>
          </select>
        </label>
        <button className="button" type="submit">
          Create targeted invite
        </button>
      </form>
      <section className="stack">
        <h2>Active members</h2>
        <div className="data-list">
          {payload.members.map((member) => (
            <form className="row" action={removeMember} key={member.id}>
              <input type="hidden" name="organizationId" value={orgId} />
              <input type="hidden" name="membershipId" value={member.id} />
              <strong>{member.user.displayName ?? member.user.email ?? 'Member'}</strong>
              <span>{member.user.email ?? 'No email'}</span>
              <span>{member.role}</span>
              <span className="actions inline">
                <button className="button danger" type="submit">
                  Remove
                </button>
              </span>
            </form>
          ))}
        </div>
      </section>
      <section className="stack">
        <h2>Pending invitations</h2>
        <div className="data-list">
          {payload.pendingInvitations.map((invitation) => (
            <form className="row" action={invitationAction} key={invitation.id}>
              <input type="hidden" name="organizationId" value={orgId} />
              <input type="hidden" name="invitationId" value={invitation.id} />
              <strong>
                {invitation.targetDisplay ??
                  invitation.targetProviderAccountId ??
                  'Claimable link'}
              </strong>
              <span>{invitation.mode}</span>
              <span>{invitation.role}</span>
              <span>{new Date(invitation.expiresAt).toLocaleDateString()}</span>
              <span className="actions inline">
                {invitation.email ? (
                  <button className="button secondary" name="action" value="resend" type="submit">
                    Resend
                  </button>
                ) : null}
                <button className="button danger" name="action" value="revoke" type="submit">
                  Revoke
                </button>
              </span>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
