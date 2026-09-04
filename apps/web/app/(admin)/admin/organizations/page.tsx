import { apiFetch } from '@/api/client';
import { OrganizationsTable, type OrganizationTableRow } from '@/components/admin/admin-tables';
import { QueryFilterSelect } from '@/components/forms/query-filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import {
  ADMIN_ORGANIZATION_REQUEST_STATUS_FILTERS,
  ADMIN_ORGANIZATION_STATUS_FILTERS,
} from '@/admin/constants';
import { getCurrentUser, requireAdminOrganizationsAccess } from '@/auth/session';
import { getOrganizationAccessState } from '@/features/organizations/server/access';
import { getMessages } from '@/i18n/messages';

type WorkspaceView = 'all' | 'mine';

const ADMIN_WORKSPACE_STATUS_FILTERS = [
  ...ADMIN_ORGANIZATION_STATUS_FILTERS,
  ...ADMIN_ORGANIZATION_REQUEST_STATUS_FILTERS,
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
  const [access, user] = await Promise.all([getOrganizationAccessState(), getCurrentUser()]);
  const messages = getMessages(user?.locale ?? 'en').adminPages;
  const defaultView: WorkspaceView = access.isPlatformAdmin ? 'all' : 'mine';
  const requestedView: WorkspaceView =
    rawView === 'mine' || rawView === 'all' ? rawView : defaultView;
  const view: WorkspaceView = access.isPlatformAdmin ? requestedView : 'mine';
  const pageUrl = adminOrganizationsUrl(view, status);
  await requireAdminOrganizationsAccess(pageUrl);
  const statusOptions = [
    { label: messages.organizations.allStatuses, value: '' },
    ...ADMIN_WORKSPACE_STATUS_FILTERS.map((item) => ({
      label: messages.statuses[item],
      value: item,
    })),
  ];

  const result = await apiFetch<OrganizationTableRow[]>(
    `/admin/organizations/workspace?${new URLSearchParams({
      view,
      ...(status ? { status } : {}),
    }).toString()}`,
  );

  return (
    <main className="page-content stack">
      <PageHeader
        title={messages.organizations.title}
        description={messages.organizations.description}
      />

      {access.isPlatformAdmin ? (
        <Tabs
          label={messages.organizations.workspaceLabel}
          items={[
            {
              label: messages.organizations.allOrganizations,
              href: adminOrganizationsUrl('all', status),
              active: view === 'all',
            },
            {
              label: messages.organizations.myOrganizations,
              href: adminOrganizationsUrl('mine', status),
              active: view === 'mine',
            },
          ]}
        />
      ) : null}

      <div className="filter-bar">
        <QueryFilterSelect
          label={messages.organizations.status}
          name="status"
          options={statusOptions}
          value={status ?? ''}
          {...(view === 'mine' ? { preserveParams: { view: 'mine' } } : {})}
        />
      </div>

      {!result.ok ? <p className="form-error">{result.error.message}</p> : null}

      <OrganizationsTable
        canManageBilling={access.isPlatformAdmin}
        data={result.ok ? result.data : []}
      />
    </main>
  );
}
