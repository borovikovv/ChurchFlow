'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { apiFetch } from '@/api/client';

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

  const result = await apiFetch('/auth/provider', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      provider,
      providerToken: 'pending-provider-configuration',
      ...(redirectTo ? { redirectTo } : {}),
    }),
  });

  const params = new URLSearchParams({
    error: result.ok ? `${provider} sign-in is not configured yet.` : result.error.message,
  });
  if (redirectTo) {
    params.set('redirectTo', redirectTo);
  }

  redirect(`/login?${params.toString()}` as Route);
}
