import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/api/client';

interface InvitationValidation {
  valid: boolean;
  reason: string | null;
  organizationName?: string;
  organizationId?: string;
  email?: string | null;
  role?: string;
  delivery?: 'email' | 'link';
}

interface AcceptInvitationResult {
  organizationId: string;
  redirectTo: string;
}

async function acceptInvitation(formData: FormData) {
  'use server';
  const token = String(formData.get('token'));
  const result = await apiFetch<AcceptInvitationResult>('/invitations/accept', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (result.ok) {
    redirect(result.data.redirectTo as Route);
  }
}

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token
    ? await apiFetch<InvitationValidation>(
        `/invitations/validate?token=${encodeURIComponent(token)}`,
      )
    : null;
  const invitation = result?.ok ? result.data : null;

  return (
    <main className="section">
      <div className="shell stack">
        <h1>Invitation</h1>
        {!token || !invitation?.valid ? (
          <p>This invitation is invalid or no longer available.</p>
        ) : (
          <>
            <dl className="details">
              <dt>Organization</dt>
              <dd>{invitation.organizationName}</dd>
              <dt>Invitation</dt>
              <dd>{invitation.email ?? 'Shareable link'}</dd>
              <dt>Role</dt>
              <dd>{invitation.role}</dd>
            </dl>
            <form action={acceptInvitation}>
              <input type="hidden" name="token" value={token} />
              <button className="button" type="submit">
                Accept invitation
              </button>
            </form>
            <Link href="/login">Sign in or create an account</Link>
          </>
        )}
      </div>
    </main>
  );
}
