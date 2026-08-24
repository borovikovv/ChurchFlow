'use server';

import type { UserSession } from '@churchflow/shared';
import { apiFetch } from '@/api/client';

export async function getSessions() {
  return apiFetch<UserSession[]>('/auth/sessions');
}

export async function revokeSession(sessionId: string) {
  const result = await apiFetch(`/auth/sessions/${sessionId}`, { method: 'DELETE' });

  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error.message };
}

export async function revokeOtherSessions() {
  const result = await apiFetch<{ revokedCount: number }>('/auth/sessions/revoke-others', {
    method: 'POST',
  });

  return result.ok
    ? { ok: true as const, data: result.data }
    : { ok: false as const, error: result.error.message };
}
