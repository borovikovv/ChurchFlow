import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { apiFetch } from '@/api/client';
import { getCurrentUser, requireServerSession } from '@/auth/session';
import { DEFAULT_APP_LOCALE } from '@/i18n/locales';
import { getMessages } from '@/i18n/messages';

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
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? DEFAULT_APP_LOCALE).auth;
  const result = await apiFetch<PendingInvitation[]>('/invitations/pending');
  const invitations = result.ok ? result.data : [];

  return (
    <main className="section auth-section">
      <div className="shell stack auth-flow-panel">
        <h1>{messages.pendingInvitations}</h1>
        <p>{messages.pendingInvitationsDescription}</p>
        {!result.ok ? <p className="text-red-600">{result.error.message}</p> : null}
        {invitations.length === 0 ? <p>{messages.noPendingInvitations}</p> : null}
        <div className="data-list">
          {invitations.map((invitation) => (
            <form className="row" action={acceptPendingInvitation} key={invitation.id}>
              <input type="hidden" name="invitationId" value={invitation.id} />
              <strong>{invitation.organizationName}</strong>
              <span>{invitation.targetDisplay ?? invitation.targetProvider}</span>
              <span>{invitation.role}</span>
              <span>
                {invitation.valid ? messages.pending : (invitation.reason ?? messages.unavailable)}
              </span>
              <button className="button" type="submit" disabled={!invitation.valid}>
                {messages.accept}
              </button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
