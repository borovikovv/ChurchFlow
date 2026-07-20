'use client';

import { useState } from 'react';
import type { AuditLogListItem } from '@churchflow/shared';
import { StatusBadge } from '@/components/ui/status-badge';
import type { HomeOrganization, OrganizationRole } from '../types';
import { AuditLogsSection } from './audit-logs-section';
import { EditOrganizationDialog } from './edit-organization-dialog';
import { OrganizationLogo } from './organization-logo';

interface OrganizationHomeManagerProps {
  organization: HomeOrganization;
  organizationRole: OrganizationRole | null;
  auditLogs: AuditLogListItem[];
  auditNextCursor: string | null;
}

export function OrganizationHomeManager({
  organization,
  organizationRole,
  auditLogs,
  auditNextCursor,
}: OrganizationHomeManagerProps) {
  const [currentOrganization, setCurrentOrganization] = useState(organization);
  const canManage = organizationRole === 'OWNER' || organizationRole === 'ADMIN';

  return (
    <div className="stack gap-20">
      <div className="stack">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <OrganizationLogo name={currentOrganization.name} url={currentOrganization.logoUrl} />
            <div className="min-w-0">
              <h1 className="m-0">Home</h1>
              <p className="m-0 text-[var(--muted)]">Organization overview and core details.</p>
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
          <dt>Name</dt>
          <dd>{currentOrganization.name}</dd>
          <dt>Slug</dt>
          <dd>{currentOrganization.slug}</dd>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={currentOrganization.status} />
          </dd>
          <dt>Description</dt>
          <dd>{currentOrganization.description ?? 'No description'}</dd>
          {organizationRole ? (
            <>
              <dt>Your role</dt>
              <dd>
                <StatusBadge status={organizationRole} />
              </dd>
            </>
          ) : null}
        </dl>
      </div>

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
