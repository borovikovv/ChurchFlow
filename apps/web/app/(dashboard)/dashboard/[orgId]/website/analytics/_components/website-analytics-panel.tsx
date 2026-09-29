'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { WebsiteAnalyticsIntegrationStatus } from '@churchflow/shared';
import { websiteAnalyticsReportsQueryKey } from '../_hooks/use-website-analytics-report';
import type { AnalyticsConnectFeedback } from '../types';
import { AnalyticsConnectionCard } from './analytics-connection-card';
import { AnalyticsDashboard } from './analytics-dashboard';

export function WebsiteAnalyticsPanel({
  feedback,
  initialStatus,
  organizationId,
}: {
  feedback: AnalyticsConnectFeedback | null;
  initialStatus: WebsiteAnalyticsIntegrationStatus;
  organizationId: string;
}) {
  const t = useTranslations('website.analytics');
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(initialStatus);
  const integration = status.integration;
  const reportPropertyId =
    integration?.mode === 'OAUTH' && integration.status === 'CONNECTED'
      ? integration.propertyId
      : null;

  const changeStatus = (next: WebsiteAnalyticsIntegrationStatus) => {
    setStatus(next);
    void queryClient.invalidateQueries({
      queryKey: websiteAnalyticsReportsQueryKey(organizationId),
    });
  };

  const markReauthRequired = () =>
    setStatus((current) =>
      current.integration
        ? { ...current, integration: { ...current.integration, status: 'NEEDS_REAUTH' } }
        : current,
    );

  return (
    <div className="grid gap-4">
      {feedback ? (
        <p className={feedback.result === 'error' ? 'form-error' : 'm-0 text-sm'} role="status">
          {feedback.result === 'error' ? t(`connectErrors.${feedback.reason}`) : t('connected')}
        </p>
      ) : null}
      <AnalyticsConnectionCard
        organizationId={organizationId}
        status={status}
        onReauthRequired={markReauthRequired}
        onStatusChange={changeStatus}
      />
      {reportPropertyId ? (
        <AnalyticsDashboard
          organizationId={organizationId}
          propertyId={reportPropertyId}
          onReauthRequired={markReauthRequired}
        />
      ) : null}
    </div>
  );
}
