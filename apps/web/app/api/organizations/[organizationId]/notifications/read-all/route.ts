import { proxyApiRequest } from '@/features/notifications/server/proxy';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await params;

  return proxyApiRequest(
    `/organizations/${encodeURIComponent(organizationId)}/notifications/read-all`,
    { method: 'PATCH' },
  );
}
