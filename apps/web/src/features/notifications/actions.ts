import type {
  NotificationDetail,
  NotificationListItem,
  NotificationsPage,
  NotificationsSummary,
} from '@churchflow/shared';

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error('Notification request failed');
  }

  return readJson<T>(response);
}

export function listNotifications(input: {
  organizationId: string;
  cursor?: string | null;
  limit: number;
}): Promise<NotificationsPage> {
  const params = new URLSearchParams({ limit: String(input.limit) });
  if (input.cursor) params.set('cursor', input.cursor);

  return requestJson<NotificationsPage>(
    `/api/organizations/${encodeURIComponent(input.organizationId)}/notifications?${params}`,
  );
}

export function getNotificationsSummary(organizationId: string): Promise<NotificationsSummary> {
  return requestJson<NotificationsSummary>(
    `/api/organizations/${encodeURIComponent(organizationId)}/notifications/summary`,
  );
}

export function getNotificationDetail(input: {
  organizationId: string;
  notificationId: string;
}): Promise<NotificationDetail> {
  return requestJson<NotificationDetail>(
    `/api/organizations/${encodeURIComponent(input.organizationId)}/notifications/${encodeURIComponent(
      input.notificationId,
    )}`,
  );
}

export function markNotificationRead(input: {
  organizationId: string;
  notificationId: string;
}): Promise<NotificationListItem> {
  return requestJson<NotificationListItem>(
    `/api/organizations/${encodeURIComponent(input.organizationId)}/notifications/${encodeURIComponent(
      input.notificationId,
    )}/read`,
    { method: 'PATCH' },
  );
}

export function markAllNotificationsRead(
  organizationId: string,
): Promise<{ updatedCount: number }> {
  return requestJson<{ updatedCount: number }>(
    `/api/organizations/${encodeURIComponent(organizationId)}/notifications/read-all`,
    { method: 'PATCH' },
  );
}
