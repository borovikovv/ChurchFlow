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

export async function requestEmailVerification() {
  const result = await apiFetch('/auth/email/verify/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });

  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error.message };
}

export async function prepareAvatarUpload(input: {
  filename: string;
  mimeType: string;
  byteSize: number;
}) {
  const result = await apiFetch<{ assetId: string; uploadUrl: string }>('/users/me/avatar/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return result.ok
    ? { ok: true as const, ...result.data }
    : { ok: false as const, error: result.error.message };
}

export async function confirmAvatarUpload(input: { assetId: string; organizationId: string }) {
  const result = await apiFetch<{ assetId: string; avatarUrl: string }>(
    '/users/me/avatar/confirm',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  return result.ok
    ? { ok: true as const, avatarUrl: result.data.avatarUrl }
    : { ok: false as const, error: result.error.message };
}

export async function removeAvatar() {
  const result = await apiFetch('/users/me/avatar', { method: 'DELETE' });
  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error.message };
}
