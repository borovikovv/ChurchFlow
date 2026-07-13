import { proxyApiRequest } from '@/features/notifications/server/proxy';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await params;

  return proxyApiRequest(
    `/organizations/${encodeURIComponent(organizationId)}/notifications/preferences`,
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await params;

  return proxyApiRequest(
    `/organizations/${encodeURIComponent(organizationId)}/notifications/preferences`,
    {
      method: 'PATCH',
      headers: { 'content-type': request.headers.get('content-type') ?? 'application/json' },
      body: await request.text(),
    },
  );
}
