import Link from 'next/link';
import type { Route } from 'next';
import { apiFetch } from '@/api/client';

interface OrganizationRequestRow {
  id: string;
  organizationName: string;
  contactName: string;
  contactEmail: string;
  status: string;
  createdAt: string;
}

export default async function AdminOrganizationRequestsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const result = await apiFetch<OrganizationRequestRow[]>(`/admin/organization-requests${query}`);
  const requests = result.ok ? result.data : [];

  return (
    <main className="section">
      <div className="shell stack">
        <h1>Organization requests</h1>
        <nav className="tabs" aria-label="Request filters">
          {['PENDING', 'APPROVED', 'REJECTED'].map((item) => (
            <Link key={item} href={`/admin/organization-requests?status=${item}` as Route}>
              {item}
            </Link>
          ))}
        </nav>
        <div className="table">
          {requests.map((request) => (
            <Link className="row" href={`/admin/organization-requests/${request.id}` as Route} key={request.id}>
              <strong>{request.organizationName}</strong>
              <span>{request.contactName}</span>
              <span>{request.contactEmail}</span>
              <span>{request.status}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
