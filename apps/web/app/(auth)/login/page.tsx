import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { apiFetch } from '@/api/client';

async function startEmailLogin(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '');
  const redirectTo = String(formData.get('redirectTo') ?? '');

  const result = await apiFetch('/auth/email/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      ...(redirectTo ? { redirectTo } : {}),
    }),
  });

  if (!result.ok) {
    const params = new URLSearchParams({ error: result.error.message });
    if (redirectTo) {
      params.set('redirectTo', redirectTo);
    }

    redirect(`/login?${params.toString()}` as Route);
  }

  redirect(`/login?sent=1${redirectTo ? `&redirectTo=${encodeURIComponent(redirectTo)}` : ''}`);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; sent?: string; error?: string }>;
}) {
  const { redirectTo, sent } = await searchParams;

  return (
    <main className="section">
      <div className="shell stack grid-center">
        <h1>Sign in</h1>
        {sent ? (
          <p>Check your email for a secure sign-in link.</p>
        ) : (
          <form className="form-grid max-w-100 w-full" action={startEmailLogin}>
            <input type="hidden" name="redirectTo" value={redirectTo ?? ''} />
            <label>
              Email
              <input name="email" type="email" required maxLength={255} />
            </label>
            <button className="button" type="submit">
              Continue with email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
