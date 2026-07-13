import { proxyApiRequest } from '@/features/notifications/server/proxy';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await params;
  const url = new URL(request.url);

  return proxyApiRequest(
    `/organizations/${encodeURIComponent(organizationId)}/notifications${url.search}`,
  );
}
