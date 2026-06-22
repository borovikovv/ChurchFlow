import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { apiFetch } from '@/api/client';
import { requireServerSession } from '@/auth/session';

interface PendingInvitation {
  id: string;
  valid: boolean;
  reason: string | null;
  organizationId: string;
  organizationName: string;
  targetProvider: string;
  targetDisplay: string | null;
  role: string;
  expiresAt: string;
}

interface AcceptInvitationResult {
  organizationId: string;
  redirectTo: string;
}

async function acceptPendingInvitation(formData: FormData) {
  'use server';
  const invitationId = String(formData.get('invitationId'));
  const result = await apiFetch<AcceptInvitationResult>(`/invitations/${invitationId}/accept`, {
    method: 'POST',
  });

  revalidatePath('/invitations/pending');

  if (result.ok) {
    redirect(result.data.redirectTo as Route);
  }
}

export default async function PendingInvitationsPage() {
  await requireServerSession('/invitations/pending');
  const result = await apiFetch<PendingInvitation[]>('/invitations/pending');
  const invitations = result.ok ? result.data : [];

  return (
    <main className="section">
      <div className="shell stack">
        <h1>Pending invitations</h1>
        <p>Accept an invitation before opening organization dashboard content.</p>
        {!result.ok ? <p className="text-red-600">{result.error.message}</p> : null}
        {invitations.length === 0 ? (
          <p>No pending invitations are available for this account.</p>
        ) : null}
        <div className="data-list">
          {invitations.map((invitation) => (
            <form className="row" action={acceptPendingInvitation} key={invitation.id}>
              <input type="hidden" name="invitationId" value={invitation.id} />
              <strong>{invitation.organizationName}</strong>
              <span>{invitation.targetDisplay ?? invitation.targetProvider}</span>
              <span>{invitation.role}</span>
              <span>{invitation.valid ? 'Pending' : (invitation.reason ?? 'Unavailable')}</span>
              <button className="button" type="submit" disabled={!invitation.valid}>
                Accept
              </button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
