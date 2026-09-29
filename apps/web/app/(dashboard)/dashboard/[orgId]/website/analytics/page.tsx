import { apiFetch } from '@/api/client';
import { getCurrentUser } from '@/auth/session';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { requireOrganizationOwnerAccess } from '@/features/organizations/server/owner-access';
import { getMessages } from '@/i18n/messages';
import type { WebsiteAnalyticsIntegrationStatus } from '@churchflow/shared';
import { websiteTabItems } from '../website-tabs';
import { readAnalyticsConnectFeedback } from './analytics-connect-feedback';
import { WebsiteAnalyticsPanel } from './_components/website-analytics-panel';

export default async function WebsiteAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const feedback = readAnalyticsConnectFeedback(await searchParams);
  await requireOrganizationOwnerAccess(orgId);
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? 'en').website;
  const statusResult = await apiFetch<WebsiteAnalyticsIntegrationStatus>(
    `/organizations/${orgId}/website/analytics`,
  );

  return (
    <main className="stack min-w-0 content-start">
      <PageHeader title={messages.title} description={messages.analytics.description} />
      <Tabs label={messages.tabs.label} items={websiteTabItems(orgId, messages)} />
      {statusResult.ok ? (
        <WebsiteAnalyticsPanel
          feedback={feedback}
          initialStatus={statusResult.data}
          organizationId={orgId}
        />
      ) : (
        <p className="form-error">{statusResult.error.message}</p>
      )}
    </main>
  );
}
