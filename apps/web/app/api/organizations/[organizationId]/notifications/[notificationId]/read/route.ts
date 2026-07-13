import { proxyApiRequest } from '@/features/notifications/server/proxy';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string; notificationId: string }> },
) {
  const { organizationId, notificationId } = await params;

  return proxyApiRequest(
    `/organizations/${encodeURIComponent(organizationId)}/notifications/${encodeURIComponent(
      notificationId,
    )}/read`,
    { method: 'PATCH' },
  );
}
