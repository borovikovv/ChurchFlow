import { apiFetch } from '@/api/client';
import { PageHeader } from '@/components/ui/page-header';
import { serverEnv } from '@/env/server';
import { requireWebsiteManageAccess } from '@/features/organizations/server/website-access';
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
  const organization = await requireWebsiteManageAccess(orgId);
  const slug = organization.slug;

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

function WebsiteLoadError({ message }: { message: string }) {
  return (
    <main className="stack">
      <PageHeader title="Website" description="Manage your public organization website." />
      <p className="form-error">{message}</p>
    </main>
  );
}
