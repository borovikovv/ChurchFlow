import { notFound } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { PageHeader } from '@/components/ui/page-header';
import { serverEnv } from '@/env/server';
import { getOrganizationAccessState } from '@/features/organizations/server/access';
import { WebsiteManager } from './_components/website-manager';
import type { DashboardPage, DashboardWebsite, WebsiteFeedback } from './types';

export default async function WebsiteDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<WebsiteFeedback>;
}) {
  const { orgId } = await params;
  const feedback = await searchParams;
  const slug = await resolveOrganizationSlug(orgId);

  if (!slug) {
    notFound();
  }

  const [websiteResult, pagesResult] = await Promise.all([
    apiFetch<DashboardWebsite>(`/organizations/${orgId}/website`),
    apiFetch<DashboardPage[]>(`/organizations/${orgId}/pages`),
  ]);

  if (!websiteResult.ok) {
    return <WebsiteLoadError message={websiteResult.error.message} />;
  }

  if (!pagesResult.ok) {
    return <WebsiteLoadError message={pagesResult.error.message} />;
  }

  const website = websiteResult.data;
  const publicUrl = `${serverEnv.NEXT_PUBLIC_WEB_URL}/o/${website.organization.slug}`;

  return (
    <WebsiteManager
      feedback={feedback}
      organizationId={orgId}
      pages={pagesResult.data}
      publicUrl={publicUrl}
      slug={slug}
      website={website}
    />
  );
}

async function resolveOrganizationSlug(organizationId: string): Promise<string | null> {
  const access = await getOrganizationAccessState();
  const membershipOrganization = access.organizations.find(
    (organization) => organization.id === organizationId,
  );

  if (membershipOrganization) {
    return membershipOrganization.slug;
  }

  if (!access.isPlatformAdmin) {
    return null;
  }

  const adminOrganization = await apiFetch<{ id: string; slug: string }>(
    `/admin/organizations/${organizationId}`,
  );

  return adminOrganization.ok ? adminOrganization.data.slug : null;
}

function WebsiteLoadError({ message }: { message: string }) {
  return (
    <main className="stack">
      <PageHeader title="Website" description="Manage your public organization website." />
      <p className="form-error">{message}</p>
    </main>
  );
}
