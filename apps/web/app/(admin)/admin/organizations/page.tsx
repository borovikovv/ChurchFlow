import Link from 'next/link';
import type { Route } from 'next';
import { apiFetch } from '@/api/client';
import { ADMIN_ORGANIZATION_STATUS_FILTERS } from '@/admin/constants';
import { requirePlatformAdmin } from '@/auth/session';

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
}

export default async function AdminOrganizationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  await requirePlatformAdmin(`/admin/organizations${status ? `?status=${status}` : ''}`);

  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const result = await apiFetch<OrganizationRow[]>(`/admin/organizations${query}`);
  const organizations = result.ok ? result.data : [];

  return (
    <main className="section">
      <div className="shell stack">
        <h1>Organizations</h1>
        <nav className="tabs" aria-label="Organization filters">
          {ADMIN_ORGANIZATION_STATUS_FILTERS.map((item) => (
            <Link key={item} href={`/admin/organizations?status=${item}` as Route}>
              {item}
            </Link>
          ))}
        </nav>
        <div className="data-list">
          {organizations.map((organization) => (
            <Link className="row" href={`/admin/organizations/${organization.id}` as Route} key={organization.id}>
              <strong>{organization.name}</strong>
              <span>{organization.slug}</span>
              <span>{organization.status}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
