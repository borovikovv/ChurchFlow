import { proxyApiRequest } from '@/features/notifications/server/proxy';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await params;

  return proxyApiRequest(
    `/organizations/${encodeURIComponent(organizationId)}/notifications/telegram/binding`,
    { method: 'DELETE' },
  );
}
