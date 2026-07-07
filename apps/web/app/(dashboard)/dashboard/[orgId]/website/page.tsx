import { notFound } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { getOrganizationAccessState } from '@/features/organizations/server/access';

interface AdminOrganizationDetail {
  id: string;
  slug: string;
}

export default async function WebsiteDashboardPage({
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
  const slug =
    membershipOrganization?.slug ?? (adminOrganization?.ok ? adminOrganization.data.slug : null);

  if (!slug) {
    notFound();
  }

  return (
    <div>
      <p>Website info coming soon</p>
    </div>
  );
}
