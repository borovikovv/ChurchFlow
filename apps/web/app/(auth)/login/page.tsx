import { redirect } from 'next/navigation';
import { apiFetch } from '@/api/client';

async function startEmailLogin(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '');
  const redirectTo = String(formData.get('redirectTo') ?? '');

  await apiFetch('/auth/email/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      ...(redirectTo ? { redirectTo } : {}),
    }),
  });

  redirect(`/login?sent=1${redirectTo ? `&redirectTo=${encodeURIComponent(redirectTo)}` : ''}`);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; sent?: string }>;
}) {
  const { redirectTo, sent } = await searchParams;

  return (
    <main className="section">
      <div className="shell stack grid-center">
        <h1>Sign in</h1>
        {sent ? (
          <p>Check your email for a secure sign-in link.</p>
        ) : (
          <form className="form-grid min-w-200 w-200" action={startEmailLogin}>
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
