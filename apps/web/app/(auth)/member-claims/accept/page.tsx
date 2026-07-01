import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { hasServerSession } from '@/auth/session';

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
  const signedIn = await hasServerSession();

  return (
    <main className="section">
      <div className="shell stack">
        <h1>Request organization access</h1>
        {error ? <p className="form-error">{error}</p> : null}
        {!token || !claim?.valid ? (
          <p>This access link is invalid, expired, or no longer available.</p>
        ) : (
          <>
            <p>An administrator of {claim.organizationName} prepared a member account for you.</p>
            {signedIn ? (
              <form action={requestAccess}>
                <input type="hidden" name="token" value={token} />
                <button className="button" type="submit">
                  Request access
                </button>
              </form>
            ) : (
              <Link
                className="button"
                href={`/login?redirectTo=${encodeURIComponent(`/member-claims/accept?token=${token}`)}`}
              >
                Continue with Telegram
              </Link>
            )}
          </>
        )}
      </div>
    </main>
  );
}
