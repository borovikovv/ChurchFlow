import { apiFetch } from '@/api/client';
import { OrganizationsTable, type OrganizationTableRow } from '@/components/admin/admin-tables';
import { QueryFilterSelect } from '@/components/forms/query-filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import {
  ADMIN_ORGANIZATION_REQUEST_STATUS_FILTERS,
  ADMIN_ORGANIZATION_STATUS_FILTERS,
} from '@/admin/constants';
import { requireAdminOrganizationsAccess } from '@/auth/session';
import { getOrganizationAccessState } from '@/features/organizations/server/access';

type WorkspaceView = 'all' | 'mine';

const ADMIN_WORKSPACE_STATUS_FILTERS = [
  ...ADMIN_ORGANIZATION_STATUS_FILTERS,
  ...ADMIN_ORGANIZATION_REQUEST_STATUS_FILTERS,
];
const ADMIN_WORKSPACE_STATUS_OPTIONS = [
  { label: 'All statuses', value: '' },
  ...ADMIN_WORKSPACE_STATUS_FILTERS.map((item) => ({ label: item, value: item })),
];

function adminOrganizationsUrl(view: WorkspaceView, status?: string): string {
  const params = new URLSearchParams();
  if (view === 'mine') {
    params.set('view', 'mine');
  }
  if (status) {
    params.set('status', status);
  }

  const query = params.toString();
  return query ? `/admin/organizations?${query}` : '/admin/organizations';
}

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string }>;
}) {
  const { view: rawView, status } = await searchParams;
  const access = await getOrganizationAccessState();
  const defaultView: WorkspaceView = access.isPlatformAdmin ? 'all' : 'mine';
  const requestedView: WorkspaceView =
    rawView === 'mine' || rawView === 'all' ? rawView : defaultView;
  const view: WorkspaceView = access.isPlatformAdmin ? requestedView : 'mine';
  const pageUrl = adminOrganizationsUrl(view, status);
  await requireAdminOrganizationsAccess(pageUrl);
  const result = await apiFetch<OrganizationTableRow[]>(
    `/admin/organizations/workspace?${new URLSearchParams({
      view,
      ...(status ? { status } : {}),
    }).toString()}`,
  );

  return (
    <main className="page-content stack">
      <PageHeader title="Organizations" description="Open organizations you administer." />

      {access.isPlatformAdmin ? (
        <Tabs
          label="Organization workspace"
          items={[
            {
              label: 'All organizations',
              href: adminOrganizationsUrl('all', status),
              active: view === 'all',
            },
            {
              label: 'My organizations',
              href: adminOrganizationsUrl('mine', status),
              active: view === 'mine',
            },
          ]}
        />
      ) : null}

      <div className="filter-bar">
        <QueryFilterSelect
          label="Status"
          name="status"
          options={ADMIN_WORKSPACE_STATUS_OPTIONS}
          value={status ?? ''}
          {...(view === 'mine' ? { preserveParams: { view: 'mine' } } : {})}
        />
      </div>

      {!result.ok ? <p className="form-error">{result.error.message}</p> : null}

      <OrganizationsTable data={result.ok ? result.data : []} />
    </main>
  );
}
