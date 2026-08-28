import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { getCurrentUser } from '@/auth/session';
import { DEFAULT_APP_LOCALE } from '@/i18n/locales';
import { getMessages } from '@/i18n/messages';

interface InvitationValidation {
  valid: boolean;
  reason: string | null;
  organizationName?: string;
  organizationId?: string;
  mode?: string;
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
  const redirectTo = invitationAcceptRoute(token);
  const messages = getMessages(DEFAULT_APP_LOCALE).auth;
  const user = await getCurrentUser();

  if (!user) {
    redirect(loginRouteForInvitation(token, messages.signInBeforeAcceptingInvitation));
  }

  const result = await apiFetch<AcceptInvitationResult>('/invitations/accept', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (result.ok) {
    redirect(result.data.redirectTo as Route);
  }

  redirect(`${redirectTo}&error=${encodeURIComponent(result.error.message)}` as Route);
}

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const result = token
    ? await apiFetch<InvitationValidation>(
        `/invitations/validate?token=${encodeURIComponent(token)}`,
      )
    : null;
  const invitation = result?.ok ? result.data : null;
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? DEFAULT_APP_LOCALE).auth;

  return (
    <main className="section auth-section">
      <div className="shell stack auth-flow-panel">
        <h1>{messages.invitationTitle}</h1>
        {error ? <p className="form-error">{error}</p> : null}
        {!token || !invitation?.valid ? (
          <p>{messages.invitationUnavailable}</p>
        ) : (
          <>
            <p>{messages.invitationDescription}</p>
            <dl className="details">
              <dt>{messages.organization}</dt>
              <dd>{invitation.organizationName}</dd>
              <dt>{messages.invitationType}</dt>
              <dd>
                {invitation.mode === 'claimable_link'
                  ? messages.claimableInviteLink
                  : messages.targetedTelegramInvite}
              </dd>
              <dt>{messages.role}</dt>
              <dd>{invitation.role}</dd>
            </dl>
            {user ? (
              <form action={acceptInvitation}>
                <input type="hidden" name="token" value={token} />
                <button className="button" type="submit">
                  {messages.acceptInvitation}
                </button>
              </form>
            ) : (
              <Link
                className="button"
                href={loginRouteForInvitation(token, messages.signInBeforeAcceptingInvitation)}
              >
                {messages.signInOrCreateAccount}
              </Link>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function invitationAcceptRoute(token: string): Route {
  return `/invitations/accept?token=${encodeURIComponent(token)}` as Route;
}

function loginRouteForInvitation(token: string, error: string): Route {
  const params = new URLSearchParams({
    redirectTo: invitationAcceptRoute(token),
    error,
  });

  return `/login?${params.toString()}` as Route;
}
