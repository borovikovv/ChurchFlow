'use server';

import { apiFetch } from '@/api/client';
import type {
  PasskeyRegistrationCredential,
  PasskeyRegistrationOptions,
  PasskeySummary,
} from '@churchflow/shared';

export async function getPasskeys() {
  return apiFetch<PasskeySummary[]>('/auth/passkeys');
}

export async function startPasskeyRegistration() {
  const result = await apiFetch<PasskeyRegistrationOptions>('/auth/passkeys/register/options', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });

  return result.ok
    ? { ok: true as const, data: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function finishPasskeyRegistration(input: {
  credential: PasskeyRegistrationCredential;
  label?: string;
}) {
  const result = await apiFetch<PasskeySummary>('/auth/passkeys/register/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  return result.ok
    ? { ok: true as const, data: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function renamePasskey(passkeyId: string, label: string) {
  const result = await apiFetch<PasskeySummary>(`/auth/passkeys/${passkeyId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ label }),
  });

  return result.ok
    ? { ok: true as const, data: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function removePasskey(passkeyId: string) {
  const result = await apiFetch(`/auth/passkeys/${passkeyId}`, { method: 'DELETE' });

  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error.message };
}
