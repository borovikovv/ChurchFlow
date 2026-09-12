import { apiFetch } from '@/api/client';
import { getCurrentUser } from '@/auth/session';
import { PageHeader } from '@/components/ui/page-header';
import { serverEnv } from '@/env/server';
import { requireOrganizationOwnerAccess } from '@/features/organizations/server/owner-access';
import { getMessages } from '@/i18n/messages';
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
  const organization = await requireOrganizationOwnerAccess(orgId);
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? 'en').website;
  const slug = organization.slug;

  const [websiteResult, pagesResult] = await Promise.all([
    apiFetch<DashboardWebsite>(`/organizations/${orgId}/website`),
    apiFetch<DashboardPage[]>(`/organizations/${orgId}/pages`),
  ]);

  if (!websiteResult.ok) {
    return (
      <WebsiteLoadError
        description={messages.loadErrorDescription}
        message={websiteResult.error.message}
        title={messages.title}
      />
    );
  }

  if (!pagesResult.ok) {
    return (
      <WebsiteLoadError
        description={messages.loadErrorDescription}
        message={pagesResult.error.message}
        title={messages.title}
      />
    );
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

function WebsiteLoadError({
  description,
  message,
  title,
}: {
  description: string;
  message: string;
  title: string;
}) {
  return (
    <main className="stack">
      <PageHeader title={title} description={description} />
      <p className="form-error">{message}</p>
    </main>
  );
}
