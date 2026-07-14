import { proxyApiRequest } from '@/features/notifications/server/proxy';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await params;

  return proxyApiRequest(
    `/organizations/${encodeURIComponent(organizationId)}/notifications/telegram/link-token`,
    { method: 'POST' },
  );
}
