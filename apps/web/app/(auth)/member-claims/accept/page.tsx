import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { getCurrentUser } from '@/auth/session';
import { DEFAULT_APP_LOCALE } from '@/i18n/locales';
import { getMessages } from '@/i18n/messages';

interface ClaimValidation {
  valid: boolean;
  organizationName?: string;
  expiresAt?: string;
}

async function requestAccess(formData: FormData) {
  'use server';
  const token = String(formData.get('token'));
  const result = await apiFetch('/membership-claims/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (result.ok) redirect('/member-claims/status' as Route);
  redirect(
    `/member-claims/accept?token=${encodeURIComponent(token)}&error=${encodeURIComponent(result.error.message)}` as Route,
  );
}

export default async function MembershipClaimAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const result = token
    ? await apiFetch<ClaimValidation>(
        `/membership-claims/validate?token=${encodeURIComponent(token)}`,
      )
    : null;
  const claim = result?.ok ? result.data : null;
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? DEFAULT_APP_LOCALE).auth;

  return (
    <main className="section auth-section">
      <div className="shell stack auth-flow-panel">
        <h1>{messages.requestOrganizationAccess}</h1>
        {error ? <p className="form-error">{error}</p> : null}
        {!token || !claim?.valid ? (
          <p>{messages.accessLinkUnavailable}</p>
        ) : (
          <>
            <p>
              {messages.memberAccountPrepared.replace(
                '{organization}',
                claim.organizationName ?? '',
              )}
            </p>
            {user ? (
              <form action={requestAccess}>
                <input type="hidden" name="token" value={token} />
                <button className="button" type="submit">
                  {messages.requestAccess}
                </button>
              </form>
            ) : (
              <Link
                className="button"
                href={`/login?redirectTo=${encodeURIComponent(`/member-claims/accept?token=${token}`)}`}
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
