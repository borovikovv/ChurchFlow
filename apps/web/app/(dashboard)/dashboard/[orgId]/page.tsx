import { notFound } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { getOrganizationAccessState } from '@/features/organizations/server/access';
import type { AuditLogsPage, SubscriptionSummary } from '@churchflow/shared';
import { OrganizationHomeManager } from './_components/organization-home-manager';
import type { OrganizationHomeApiResponse } from './types';

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
      ? await apiFetch<OrganizationHomeApiResponse>(`/admin/organizations/${orgId}`)
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

  const logoAssetId = organization.website?.logoAssetId ?? null;
  const canManage = organizationRole === 'OWNER' || organizationRole === 'ADMIN';
  const [logoUrlResult, auditResult, billingResult] = await Promise.all([
    logoAssetId
      ? apiFetch<{ url: string }>(`/organizations/${organization.id}/media/${logoAssetId}/read-url`)
      : Promise.resolve(null),
    canManage
      ? apiFetch<AuditLogsPage>(`/organizations/${organization.id}/audit-logs?limit=10`)
      : Promise.resolve(null),
    canManage
      ? apiFetch<SubscriptionSummary>(`/organizations/${organization.id}/billing`)
      : Promise.resolve(null),
  ]);
  const logoUrl = logoUrlResult?.ok ? logoUrlResult.data.url : null;
  const auditPage = auditResult?.ok ? auditResult.data : { items: [], nextCursor: null };

  return (
    <OrganizationHomeManager
      organization={{
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        description: organization.description,
        logoAssetId,
        logoUrl,
      }}
      organizationRole={organizationRole}
      auditLogs={auditPage.items}
      auditNextCursor={auditPage.nextCursor}
      subscription={billingResult?.ok ? billingResult.data : null}
      subscriptionError={billingResult && !billingResult.ok ? billingResult.error.message : null}
    />
  );
}
