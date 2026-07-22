'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { DataTable } from '@/components/ui/data-table';
import { organizationHomeRoute } from '@/features/organizations/routes';
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
  contactTelegramId: string;
  contactTelegramUsername: string | null;
  status: string;
  createdAt: string;
}

export function OrganizationsTable({ data }: { data: OrganizationTableRow[] }) {
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
  ];

  return (
    <DataTable
      columns={organizationColumns}
      data={data}
      emptyMessage={t('tables.emptyOrganizations')}
      getRowHref={(organization) =>
        organization.itemType === 'request'
          ? `/admin/organization-requests/${organization.id}`
          : organizationHomeRoute(organization.id)
      }
    />
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
      accessorFn: (row) => row.contactEmail ?? row.contactTelegramUsername ?? row.contactTelegramId,
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
