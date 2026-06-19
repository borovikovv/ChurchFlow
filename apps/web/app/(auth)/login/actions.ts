'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';

export async function startProviderLogin(formData: FormData) {
  const provider = String(formData.get('provider') ?? '');
  const redirectTo = String(formData.get('redirectTo') ?? '');

  if (provider === 'telegram') {
    const params = new URLSearchParams();
    if (redirectTo) {
      params.set('redirectTo', redirectTo);
    }

    const query = params.size > 0 ? `?${params.toString()}` : '';
    redirect(`/v1/auth/telegram/start${query}` as Route);
  }

  const params = new URLSearchParams({ error: 'Unsupported sign-in provider.' });
  if (redirectTo) {
    params.set('redirectTo', redirectTo);
  }

  redirect(`/login?${params.toString()}` as Route);
}
