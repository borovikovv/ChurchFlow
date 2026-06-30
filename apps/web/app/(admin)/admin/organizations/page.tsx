import { apiFetch } from '@/api/client';
import {
  OrganizationRequestsTable,
  OrganizationsTable,
  type OrganizationRequestTableRow,
  type OrganizationTableRow,
} from '@/components/admin/admin-tables';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import {
  ADMIN_ORGANIZATION_REQUEST_STATUS_FILTERS,
  ADMIN_ORGANIZATION_STATUS_FILTERS,
} from '@/admin/constants';
import { requirePlatformAdmin } from '@/auth/session';

type WorkspaceView = 'organizations' | 'requests';

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string }>;
}) {
  const { view: rawView, status } = await searchParams;
  const view: WorkspaceView = rawView === 'requests' ? 'requests' : 'organizations';
  const pageUrl = `/admin/organizations${view === 'requests' ? '?view=requests' : ''}`;
  await requirePlatformAdmin(pageUrl);

  const endpoint = view === 'requests' ? '/admin/organization-requests' : '/admin/organizations';
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const result = await apiFetch<OrganizationTableRow[] | OrganizationRequestTableRow[]>(
    `${endpoint}${query}`,
  );

  const statusItems =
    view === 'requests'
      ? ADMIN_ORGANIZATION_REQUEST_STATUS_FILTERS
      : ADMIN_ORGANIZATION_STATUS_FILTERS;

  return (
    <main className="page-content stack">
      <PageHeader
        title="Organizations"
        description="Review organization access requests and manage every ChurchFlow tenant."
      />

      <Tabs
        label="Organization workspace"
        items={[
          {
            label: 'Organizations',
            href: '/admin/organizations',
            active: view === 'organizations',
          },
          {
            label: 'Requests',
            href: '/admin/organizations?view=requests',
            active: view === 'requests',
          },
        ]}
      />

      <div className="filter-bar">
        <span className="filter-label">Status</span>
        <Tabs
          label={`${view} status filters`}
          items={[
            {
              label: 'ALL',
              href:
                view === 'requests' ? '/admin/organizations?view=requests' : '/admin/organizations',
              active: !status,
            },
            ...statusItems.map((item) => ({
              label: item,
              href:
                view === 'requests'
                  ? `/admin/organizations?view=requests&status=${item}`
                  : `/admin/organizations?status=${item}`,
              active: status === item,
            })),
          ]}
        />
      </div>

      {!result.ok ? <p className="form-error">{result.error.message}</p> : null}

      {view === 'organizations' ? (
        <OrganizationsTable data={result.ok ? (result.data as OrganizationTableRow[]) : []} />
      ) : (
        <OrganizationRequestsTable
          data={result.ok ? (result.data as OrganizationRequestTableRow[]) : []}
        />
      )}
    </main>
  );
}
