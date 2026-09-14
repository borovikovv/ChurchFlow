import { notFound } from 'next/navigation';
import { apiFetch } from '@/api/client';
import {
  getOrganizationAccessState,
  isOrganizationAdminRole,
  isOrganizationOwnerRole,
} from '@/features/organizations/server/access';
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
  const canManage = organizationRole !== null && isOrganizationAdminRole(organizationRole);
  // Billing is narrower than the rest of what an administrator manages: the API answers these
  // routes for the owner and for platform admins only, so anyone else shown the section would
  // meet a 403 behind every button in it.
  const canManageBilling = organizationRole !== null && isOrganizationOwnerRole(organizationRole);
  const [logoUrlResult, auditResult, billingResult] = await Promise.all([
    logoAssetId
      ? apiFetch<{ url: string }>(`/organizations/${organization.id}/media/${logoAssetId}/read-url`)
      : Promise.resolve(null),
    canManage
      ? apiFetch<AuditLogsPage>(`/organizations/${organization.id}/audit-logs?limit=10`)
      : Promise.resolve(null),
    canManageBilling
      ? apiFetch<SubscriptionSummary>(`/organizations/${organization.id}/billing`)
      : Promise.resolve(null),
  ]);
  const logoUrl = logoUrlResult?.ok ? logoUrlResult.data.url : null;
  const auditPage = auditResult?.ok ? auditResult.data : null;

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
      canManageBilling={canManageBilling}
      auditLogs={auditPage?.items}
      auditNextCursor={auditPage?.nextCursor ?? null}
      subscription={billingResult?.ok ? billingResult.data : null}
      subscriptionError={billingResult && !billingResult.ok ? billingResult.error.message : null}
    />
  );
}
