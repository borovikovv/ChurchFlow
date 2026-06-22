import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { hasServerSession } from '@/auth/session';

interface InvitationValidation {
  valid: boolean;
  reason: string | null;
  organizationName?: string;
  organizationId?: string;
  mode?: string;
  targetProvider?: string | null;
  targetProviderAccountId?: string | null;
  targetDisplay?: string | null;
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
  const isSignedIn = await hasServerSession();

  return (
    <main className="section">
      <div className="shell stack">
        <h1>Invitation</h1>
        {!token || !invitation?.valid ? (
          <p>This invitation is invalid or no longer available.</p>
        ) : (
          <>
            <p>
              You must accept this invitation before organization dashboard content is available.
            </p>
            <dl className="details">
              <dt>Organization</dt>
              <dd>{invitation.organizationName}</dd>
              <dt>Invitation type</dt>
              <dd>{invitation.mode === 'claimable_link' ? 'Claimable Telegram link' : 'Targeted Telegram invite'}</dd>
              {invitation.mode === 'targeted_telegram' ? (
                <>
                  <dt>Invited account</dt>
                  <dd>{invitation.targetDisplay ?? invitation.targetProviderAccountId}</dd>
                  <dt>Provider</dt>
                  <dd>{invitation.targetProvider}</dd>
                </>
              ) : null}
              <dt>Role</dt>
              <dd>{invitation.role}</dd>
            </dl>
            {isSignedIn ? (
              <form action={acceptInvitation}>
                <input type="hidden" name="token" value={token} />
                <button className="button" type="submit">
                  Accept invitation
                </button>
              </form>
            ) : (
              <Link
                className="button"
                href={`/login?redirectTo=${encodeURIComponent(`/invitations/accept?token=${token}`)}`}
              >
                Sign in or create an account
              </Link>
            )}
          </>
        )}
      </div>
    </main>
  );
}
