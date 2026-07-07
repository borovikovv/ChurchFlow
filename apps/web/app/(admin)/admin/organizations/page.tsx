import { apiFetch } from '@/api/client';
import { OrganizationsTable, type OrganizationTableRow } from '@/components/admin/admin-tables';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { ADMIN_ORGANIZATION_STATUS_FILTERS } from '@/admin/constants';
import { requireAdminOrganizationsAccess } from '@/auth/session';
import {
  getOrganizationAccessState,
  isOrganizationAdminRole,
} from '@/features/organizations/server/access';

type WorkspaceView = 'all' | 'mine';

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
  const pageUrl = `/admin/organizations${view === 'mine' ? '?view=mine' : ''}`;
  await requireAdminOrganizationsAccess(pageUrl);
  const adminOrganizations = access.organizations.filter((organization) =>
    isOrganizationAdminRole(organization.role),
  );
  const result =
    view === 'all' && access.isPlatformAdmin
      ? await apiFetch<OrganizationTableRow[]>(
          `/admin/organizations${status ? `?status=${encodeURIComponent(status)}` : ''}`,
        )
      : ({
          ok: true as const,
          data: adminOrganizations
            .filter((organization) => !status || organization.status === status)
            .map((organization) => ({
              ...organization,
              _count: {
                members: 0,
                invitations: 0,
              },
            })),
        } satisfies { ok: true; data: OrganizationTableRow[] });

  return (
    <main className="page-content stack">
      <PageHeader title="Organizations" description="Open organizations you administer." />

      {access.isPlatformAdmin ? (
        <Tabs
          label="Organization workspace"
          items={[
            {
              label: 'All organizations',
              href: '/admin/organizations',
              active: view === 'all',
            },
            {
              label: 'My organizations',
              href: '/admin/organizations?view=mine',
              active: view === 'mine',
            },
          ]}
        />
      ) : null}

      <div className="filter-bar">
        <span className="filter-label">Status</span>
        <Tabs
          label={`${view} status filters`}
          items={[
            {
              label: 'ALL',
              href: view === 'mine' ? '/admin/organizations?view=mine' : '/admin/organizations',
              active: !status,
            },
            ...ADMIN_ORGANIZATION_STATUS_FILTERS.map((item) => ({
              label: item,
              href:
                view === 'mine'
                  ? `/admin/organizations?view=mine&status=${item}`
                  : `/admin/organizations?status=${item}`,
              active: status === item,
            })),
          ]}
        />
      </div>

      {!result.ok ? <p className="form-error">{result.error.message}</p> : null}

      <OrganizationsTable data={result.ok ? result.data : []} />
    </main>
  );
}
