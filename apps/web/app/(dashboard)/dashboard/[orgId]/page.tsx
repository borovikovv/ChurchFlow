import { notFound } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { StatusBadge } from '@/components/ui/status-badge';
import { getOrganizationAccessState } from '@/features/organizations/server/access';

interface AdminOrganizationDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  description: string | null;
}

export default async function OrganizationDashboardPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const access = await getOrganizationAccessState();
  const membershipOrganization = access.organizations.find(
    (organization) => organization.id === orgId,
  );
  const adminOrganization =
    !membershipOrganization && access.isPlatformAdmin
      ? await apiFetch<AdminOrganizationDetail>(`/admin/organizations/${orgId}`)
      : null;

  if (!membershipOrganization && !adminOrganization?.ok) {
    notFound();
  }

  const organization =
    membershipOrganization ?? (adminOrganization?.ok ? adminOrganization.data : null);
  const organizationRole = membershipOrganization?.role ?? null;

  if (!organization) {
    notFound();
  }

  return (
    <div className="stack">
      <h1>Home</h1>
      <p>Organization overview and core details.</p>
      <dl className="details">
        <dt>Name</dt>
        <dd>{organization.name}</dd>
        <dt>Slug</dt>
        <dd>{organization.slug}</dd>
        <dt>Status</dt>
        <dd>
          <StatusBadge status={organization.status} />
        </dd>
        <dt>Description</dt>
        <dd>{organization.description ?? 'No description'}</dd>
        {organizationRole ? (
          <>
            <dt>Your role</dt>
            <dd>
              <StatusBadge status={organizationRole} />
            </dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}
