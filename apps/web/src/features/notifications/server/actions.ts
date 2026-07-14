'use server';

import type {
  NotificationPreferences,
  TelegramNotificationDisconnect,
  TelegramNotificationLink,
  UpdateNotificationPreferencesInput,
} from '@churchflow/shared';
import { apiFetch } from '@/api/client';

export async function getNotificationPreferences(organizationId: string) {
  return apiFetch<NotificationPreferences>(
    `/organizations/${organizationId}/notifications/preferences`,
  );
}

export async function updateNotificationPreferences(
  organizationId: string,
  input: UpdateNotificationPreferencesInput,
) {
  const result = await apiFetch<NotificationPreferences>(
    `/organizations/${organizationId}/notifications/preferences`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  );

  return result.ok
    ? { ok: true as const, data: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function createTelegramNotificationLink(organizationId: string) {
  const result = await apiFetch<TelegramNotificationLink>(
    `/organizations/${organizationId}/notifications/telegram/link-token`,
    { method: 'POST' },
  );

  return result.ok
    ? { ok: true as const, data: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function disconnectTelegramNotifications(organizationId: string) {
  const result = await apiFetch<TelegramNotificationDisconnect>(
    `/organizations/${organizationId}/notifications/telegram/binding`,
    { method: 'DELETE' },
  );

  return result.ok
    ? { ok: true as const, data: result.data }
    : { ok: false as const, error: result.error.message };
}
