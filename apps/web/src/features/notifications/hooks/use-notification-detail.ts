'use client';

import { useQuery } from '@tanstack/react-query';
import { getNotificationDetail, markNotificationRead } from '../actions';

export function useNotificationDetail({
  organizationId,
  notificationId,
}: {
  organizationId: string;
  notificationId: string | null;
}) {
  return useQuery({
    enabled: Boolean(notificationId),
    queryKey: ['notification-detail', organizationId, notificationId],
    queryFn: async () => {
      const detail = await getNotificationDetail({
        organizationId,
        notificationId: notificationId ?? '',
      });
      if (detail.readAt || !notificationId) return detail;

      try {
        const updated = await markNotificationRead({ organizationId, notificationId });
        return { ...detail, readAt: updated.readAt };
      } catch {
        return detail;
      }
    },
  });
}
