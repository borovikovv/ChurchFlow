'use server';

import type { UpdateCurrentUserProfileInput } from '@churchflow/shared';
import { apiFetch } from '@/api/client';

export async function updateCurrentUserProfile(input: UpdateCurrentUserProfileInput) {
  const result = await apiFetch('/users/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error.message };
}
