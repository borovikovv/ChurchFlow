import Link from 'next/link';
import type { Route } from 'next';
import { apiFetch } from '@/api/client';
import { ADMIN_ORGANIZATION_REQUEST_STATUS_FILTERS } from '@/admin/constants';
import { requirePlatformAdmin } from '@/auth/session';

interface OrganizationRequestRow {
  id: string;
  organizationName: string;
  contactName: string;
  contactEmail: string;
  contactTelegramId: string;
  contactTelegramUsername: string | null;
  status: string;
  createdAt: string;
}

export default async function AdminOrganizationRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  await requirePlatformAdmin(`/admin/organization-requests${status ? `?status=${status}` : ''}`);

  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const result = await apiFetch<OrganizationRequestRow[]>(`/admin/organization-requests${query}`);
  const requests = result.ok ? result.data : [];

  return (
    <main className="section">
      <div className="shell stack justify-items-center">
        <h1>Organization requests</h1>
        <nav className="tabs" aria-label="Request filters">
          {ADMIN_ORGANIZATION_REQUEST_STATUS_FILTERS.map((item) => (
            <Link key={item} href={`/admin/organization-requests?status=${item}` as Route}>
              {item}
            </Link>
          ))}
        </nav>
        {!result.ok ? <p className="text-red-600">{result.error.message}</p> : null}
        <div className="data-list">
          {requests.map((request) => (
            <Link
              className="row"
              href={`/admin/organization-requests/${request.id}` as Route}
              key={request.id}
            >
              <strong>{request.organizationName}</strong>
              <span>{request.contactName}</span>
              <span>{request.contactTelegramUsername ?? request.contactTelegramId}</span>
              <span>{request.status}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
