'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CardList } from '@/components/ui/card-list';
import { DataTable } from '@/components/ui/data-table';
import { organizationHomeRoute } from '@/features/organizations/routes';
import { OrganizationRowActions } from '@/components/admin/organization-row-actions';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatIsoDate } from '@/lib/format-date';

export interface OrganizationTableRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  subtitle?: string;
  itemType?: 'organization' | 'request';
  isExempt?: boolean;
  _count?: {
    members: number;
    invitations: number;
  };
  role?: string;
}

export interface OrganizationRequestTableRow {
  id: string;
  organizationName: string;
  contactName: string;
  contactEmail: string | null;
  contactTelegramId: string | null;
  contactTelegramUsername: string | null;
  status: string;
  createdAt: string;
}

export function OrganizationsTable({
  canManageBilling = false,
  data,
}: {
  canManageBilling?: boolean;
  data: OrganizationTableRow[];
}) {
  const t = useTranslations('adminPages');
  const organizationColumns: Array<ColumnDef<OrganizationTableRow>> = [
    {
      accessorKey: 'name',
      header: t('tables.organization'),
      cell: ({ row }) => (
        <div className="table-primary-cell">
          <strong>{row.original.name}</strong>
          <span>{row.original.subtitle ?? row.original.slug}</span>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: t('tables.status'),
      cell: ({ getValue }) => {
        const status = String(getValue());
        return <StatusBadge label={t(`statuses.${status}`)} status={status} />;
      },
    },
    {
      id: 'members',
      accessorFn: (row) => row._count?.members ?? 0,
      header: t('tables.members'),
      cell: ({ row, getValue }) => (row.original.itemType === 'request' ? '—' : getValue()),
    },
    {
      accessorKey: 'createdAt',
      header: t('tables.created'),
      cell: ({ getValue }) => formatIsoDate(String(getValue())),
    },
    ...(canManageBilling
      ? [
          {
            id: 'actions',
            header: '',
            cell: ({ row }) => renderOrganizationActions(row.original),
            meta: {
              headerClassName: 'w-11',
              cellClassName: 'w-11',
            },
          } satisfies ColumnDef<OrganizationTableRow>,
        ]
      : []),
  ];

  const organizationHref = (organization: OrganizationTableRow) =>
    organization.itemType === 'request'
      ? (`/admin/organization-requests/${organization.id}` as Route)
      : organizationHomeRoute(organization.id);

  return (
    <>
      <div className="md:hidden">
        <CardList
          data={data}
          emptyMessage={t('tables.emptyOrganizations')}
          getCardKey={(organization) => organization.id}
          renderCard={(organization) => (
            <OrganizationCard
              actions={renderOrganizationActions(organization)}
              href={organizationHref(organization)}
              organization={organization}
            />
          )}
        />
      </div>
      <div className="hidden md:block">
        <DataTable
          columns={organizationColumns}
          data={data}
          emptyMessage={t('tables.emptyOrganizations')}
          getRowHref={organizationHref}
        />
      </div>
    </>
  );

  // Keyed on the exemption so a successful grant remounts the menu: the action state resets and
  // the menu closes without a second round trip.
  function renderOrganizationActions(organization: OrganizationTableRow): ReactNode {
    if (!canManageBilling || organization.itemType === 'request') return null;

    return (
      <OrganizationRowActions
        isExempt={organization.isExempt ?? false}
        key={`${organization.id}:${organization.isExempt ?? false}`}
        organizationId={organization.id}
        organizationName={organization.name}
      />
    );
  }
}

function OrganizationCard({
  actions,
  href,
  organization,
}: {
  actions?: ReactNode;
  href: Route;
  organization: OrganizationTableRow;
}) {
  const t = useTranslations('adminPages');

  return (
    <>
      <Link className="absolute inset-0 rounded-[var(--radius)]" href={href}>
        <span className="sr-only">{organization.name}</span>
      </Link>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="table-primary-cell min-w-0">
          <strong>{organization.name}</strong>
          <span>{organization.subtitle ?? organization.slug}</span>
        </div>
        <StatusBadge label={t(`statuses.${organization.status}`)} status={organization.status} />
        {actions}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--muted)]">
        {organization.itemType === 'request' ? null : (
          <>
            <span>
              {t('tables.members')}: {organization._count?.members ?? 0}
            </span>
            <span aria-hidden="true">·</span>
          </>
        )}
        <span>
          {t('tables.created')}: {formatIsoDate(organization.createdAt)}
        </span>
      </div>
    </>
  );
}

export function OrganizationRequestsTable({ data }: { data: OrganizationRequestTableRow[] }) {
  const t = useTranslations('adminPages');
  const requestColumns: Array<ColumnDef<OrganizationRequestTableRow>> = [
    {
      accessorKey: 'organizationName',
      header: t('tables.organization'),
      cell: ({ row }) => (
        <div className="table-primary-cell">
          <strong>{row.original.organizationName}</strong>
          <span>{row.original.contactName}</span>
        </div>
      ),
    },
    {
      id: 'contact',
      accessorFn: (row) =>
        row.contactEmail ?? row.contactTelegramUsername ?? row.contactTelegramId ?? '',
      header: t('tables.contact'),
    },
    {
      accessorKey: 'status',
      header: t('tables.status'),
      cell: ({ getValue }) => {
        const status = String(getValue());
        return <StatusBadge label={t(`statuses.${status}`)} status={status} />;
      },
    },
    {
      accessorKey: 'createdAt',
      header: t('tables.submitted'),
      cell: ({ getValue }) => formatIsoDate(String(getValue())),
    },
  ];

  return (
    <DataTable
      columns={requestColumns}
      data={data}
      emptyMessage={t('tables.emptyRequests')}
      getRowHref={(request) => `/admin/organization-requests/${request.id}`}
    />
  );
}
