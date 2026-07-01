import type { OrganizationRequestStatusItem } from '@churchflow/shared';
import { apiFetch } from '@/api/client';
import { requireServerSession } from '@/auth/session';
import { OrganizationRequestStatusContent } from './_components/organization-request-status-content';

export default async function OrganizationRequestStatusPage() {
  await requireServerSession('/organization-request/status');
  const result = await apiFetch<OrganizationRequestStatusItem[]>('/organization-requests/mine');
  const requests = result.ok ? result.data : [];

  return (
    <OrganizationRequestStatusContent
      initialRequests={requests}
      loadError={result.ok ? null : result.error.message}
    />
  );
}
