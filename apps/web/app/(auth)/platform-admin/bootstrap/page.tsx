import Link from 'next/link';
import type { Metadata, Route } from 'next';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { hasServerSession } from '@/auth/session';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

interface BootstrapState {
  valid: boolean;
  reason: 'AVAILABLE' | 'NOT_FOUND' | 'EXPIRED' | 'CONSUMED' | 'ADMIN_EXISTS';
  expiresAt: string | null;
}

interface ConsumeResult {
  redirectTo: string;
}

async function consumeBootstrap(formData: FormData) {
  'use server';

  const token = String(formData.get('token') ?? '');
  const result = await apiFetch<ConsumeResult>('/platform-admin/bootstrap/consume', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (result.ok) {
    redirect(result.data.redirectTo as Route);
  }

  const params = new URLSearchParams({ token, error: result.error.message });
  redirect(
    `/platform-admin/bootstrap?${params.toString()}` as Route,
  );
}

export default async function PlatformAdminBootstrapPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const result = token
    ? await apiFetch<BootstrapState>('/platform-admin/bootstrap/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      })
    : null;
  const state = result?.ok ? result.data : null;
  const isSignedIn = await hasServerSession();

  return (
    <main className="section">
      <div className="shell stack auth-panel">
        <h1>Platform administrator bootstrap</h1>
        {error ? <p className="form-error">{error}</p> : null}
        {!token || !state?.valid ? (
          <p>
            This bootstrap is unavailable
            {state?.reason ? `: ${state.reason.toLowerCase().replaceAll('_', ' ')}` : ''}.
          </p>
        ) : (
          <>
            <p>
              Continue with Telegram to create the first platform super administrator. This
              one-time bootstrap expires at {new Date(state.expiresAt ?? '').toLocaleString()}.
            </p>
            {isSignedIn ? (
              <form action={consumeBootstrap}>
                <input type="hidden" name="token" value={token} />
                <button className="button" type="submit">
                  Become platform super administrator
                </button>
              </form>
            ) : (
              <Link
                className="button"
                href={
                  `/login?redirectTo=${encodeURIComponent(`/platform-admin/bootstrap?token=${token}`)}` as Route
                }
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
