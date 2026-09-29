'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { toast } from 'react-toastify';
import type { WebsiteAnalyticsIntegrationStatus } from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';
import { StatusBadge } from '@/components/ui/status-badge';
import { disconnectWebsiteAnalyticsAction } from '../actions';
import { AnalyticsMeasurementIdDialog } from './analytics-measurement-id-dialog';
import { AnalyticsPropertyDialog } from './analytics-property-dialog';

export function AnalyticsConnectionCard({
  organizationId,
  status,
  onReauthRequired,
  onStatusChange,
}: {
  organizationId: string;
  status: WebsiteAnalyticsIntegrationStatus;
  onReauthRequired: () => void;
  onStatusChange: (status: WebsiteAnalyticsIntegrationStatus) => void;
}) {
  const t = useTranslations('website');
  const integration = status.integration;
  // A plain navigation, not a fetch or a prefetched link: the API answers with a redirect to
  // Google and sets the cookie that ties the consent round trip to this browser.
  const connectUrl = `/v1/organizations/${organizationId}/website/analytics/google/connect`;

  const connectForm = (label: string) =>
    status.oauthAvailable ? (
      <form action={connectUrl} method="get">
        <Button type="submit">{label}</Button>
      </form>
    ) : null;

  const disconnectForm = (
    <form
      action={async () => {
        const result = await disconnectWebsiteAnalyticsAction({ organizationId });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        onStatusChange(result.data);
        toast.success(t('analytics.disconnected'));
      }}
    >
      <ConfirmSubmitButton
        cancelLabel={t('cancel')}
        confirmLabel={t('analytics.disconnect')}
        confirmVariant="danger"
        description={t('analytics.disconnectDescription')}
        pendingLabel={t('analytics.disconnecting')}
        title={t('analytics.disconnectTitle')}
        triggerLabel={t('analytics.disconnect')}
        variant="ghost"
      />
    </form>
  );

  const measurementIdDialog = (label: string) => (
    <AnalyticsMeasurementIdDialog
      currentMeasurementId={integration?.mode === 'MANUAL' ? integration.measurementId : null}
      organizationId={organizationId}
      triggerLabel={label}
      onStatusChange={onStatusChange}
    />
  );

  if (!integration) {
    return (
      <Card title={t('analytics.notConnectedTitle')}>
        <p className="m-0 text-sm text-[var(--muted)]">
          {status.oauthAvailable
            ? t('analytics.notConnectedDescription')
            : t('analytics.oauthUnavailable')}
        </p>
        <div className="flex flex-wrap gap-2">
          {connectForm(t('analytics.connectGoogle'))}
          {measurementIdDialog(t('analytics.useMeasurementId'))}
        </div>
      </Card>
    );
  }

  if (integration.mode === 'MANUAL') {
    return (
      <Card
        badge={
          <StatusBadge
            label={t('analytics.trackingWith', { measurementId: integration.measurementId ?? '' })}
            status="ACTIVE"
          />
        }
        title={t('analytics.connection')}
      >
        <p className="m-0 text-sm text-[var(--muted)]">
          {t('analytics.manualModeDescription', {
            measurementId: integration.measurementId ?? '',
          })}
        </p>
        <div className="flex flex-wrap gap-2">
          {connectForm(t('analytics.connectGoogle'))}
          {measurementIdDialog(t('analytics.changeMeasurementId'))}
          {disconnectForm}
        </div>
      </Card>
    );
  }

  if (integration.status === 'NEEDS_REAUTH') {
    return (
      <Card
        badge={<StatusBadge label={t('analytics.reconnectTitle')} status="PENDING" />}
        title={t('analytics.connection')}
      >
        <p className="m-0 text-sm text-[var(--muted)]">{t('analytics.reconnectDescription')}</p>
        <div className="flex flex-wrap gap-2">
          {connectForm(t('analytics.reconnect'))}
          {disconnectForm}
        </div>
      </Card>
    );
  }

  return (
    <Card
      badge={
        integration.measurementId ? (
          <StatusBadge
            label={t('analytics.trackingWith', { measurementId: integration.measurementId })}
            status="ACTIVE"
          />
        ) : null
      }
      title={t('analytics.connection')}
    >
      <dl className="m-0 grid gap-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-4">
        <dt className="text-[var(--muted)]">{t('analytics.account')}</dt>
        <dd className="m-0">
          {integration.googleAccountEmail
            ? t('analytics.connectedAs', { email: integration.googleAccountEmail })
            : t('analytics.connectedAccountUnknown')}
        </dd>
        <dt className="text-[var(--muted)]">{t('analytics.property')}</dt>
        <dd className="m-0">
          {integration.propertyDisplayName ?? t('analytics.propertyRequired')}
        </dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <AnalyticsPropertyDialog
          organizationId={organizationId}
          selectedPropertyId={integration.propertyId}
          selectedStreamId={integration.streamId}
          triggerLabel={
            integration.propertyId ? t('analytics.changeProperty') : t('analytics.chooseProperty')
          }
          onReauthRequired={onReauthRequired}
          onStatusChange={onStatusChange}
        />
        {disconnectForm}
      </div>
    </Card>
  );
}

function Card({
  badge,
  children,
  title,
}: {
  badge?: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-base">{title}</h2>
        {badge}
      </div>
      {children}
    </section>
  );
}
