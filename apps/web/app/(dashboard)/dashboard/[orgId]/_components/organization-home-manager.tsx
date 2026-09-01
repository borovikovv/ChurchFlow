'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { AuditLogListItem, SubscriptionSummary } from '@churchflow/shared';
import { StatusBadge } from '@/components/ui/status-badge';
import type { HomeOrganization, OrganizationRole } from '../types';
import { AuditLogsSection } from './audit-logs-section';
import { BillingSection } from './billing-section';
import { EditOrganizationDialog } from './edit-organization-dialog';
import { OrganizationLogo } from './organization-logo';

interface OrganizationHomeManagerProps {
  organization: HomeOrganization;
  organizationRole: OrganizationRole | null;
  auditLogs: AuditLogListItem[];
  auditNextCursor: string | null;
  subscription: SubscriptionSummary | null;
  subscriptionError: string | null;
}

export function OrganizationHomeManager({
  organization,
  organizationRole,
  auditLogs,
  auditNextCursor,
  subscription,
  subscriptionError,
}: OrganizationHomeManagerProps) {
  const t = useTranslations('home');
  const [currentOrganization, setCurrentOrganization] = useState(organization);
  const canManage = organizationRole === 'OWNER' || organizationRole === 'ADMIN';

  return (
    <div className="stack gap-20">
      <div className="stack">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <OrganizationLogo name={currentOrganization.name} url={currentOrganization.logoUrl} />
            <div className="min-w-0">
              <h1 className="m-0">{t('title')}</h1>
              <p className="m-0 text-[var(--muted)]">{t('description')}</p>
            </div>
          </div>
          {canManage ? (
            <EditOrganizationDialog
              organization={currentOrganization}
              onUpdated={setCurrentOrganization}
            />
          ) : null}
        </div>
        <dl className="details">
          <dt>{t('name')}</dt>
          <dd>{currentOrganization.name}</dd>
          <dt>{t('slug')}</dt>
          <dd>{currentOrganization.slug}</dd>
          <dt>{t('status')}</dt>
          <dd>
            <StatusBadge status={currentOrganization.status} />
          </dd>
          <dt>{t('organizationDescription')}</dt>
          <dd>{currentOrganization.description ?? t('noDescription')}</dd>
          {organizationRole ? (
            <>
              <dt>{t('yourRole')}</dt>
              <dd>
                <StatusBadge status={organizationRole} />
              </dd>
            </>
          ) : null}
        </dl>
      </div>

      {canManage ? (
        <BillingSection
          loadError={subscriptionError}
          organizationId={currentOrganization.id}
          subscription={subscription}
        />
      ) : null}

      {canManage ? (
        <AuditLogsSection
          organizationId={currentOrganization.id}
          initialItems={auditLogs}
          initialNextCursor={auditNextCursor}
        />
      ) : null}
    </div>
  );
}
