'use client';

import type { ColumnDef } from '@tanstack/react-table';
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

const organizationColumns: Array<ColumnDef<OrganizationTableRow>> = [
  {
    accessorKey: 'name',
    header: 'Organization',
    cell: ({ row }) => (
      <div className="table-primary-cell">
        <strong>{row.original.name}</strong>
        <span>{row.original.subtitle ?? row.original.slug}</span>
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
  },
  {
    id: 'members',
    accessorFn: (row) => row._count?.members ?? 0,
    header: 'Members',
    cell: ({ row, getValue }) => (row.original.itemType === 'request' ? '—' : getValue()),
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ getValue }) => formatIsoDate(String(getValue())),
  },
];

const requestColumns: Array<ColumnDef<OrganizationRequestTableRow>> = [
  {
    accessorKey: 'organizationName',
    header: 'Organization',
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
    header: 'Contact',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
  },
  {
    accessorKey: 'createdAt',
    header: 'Submitted',
    cell: ({ getValue }) => formatIsoDate(String(getValue())),
  },
];

export function OrganizationsTable({ data }: { data: OrganizationTableRow[] }) {
  return (
    <DataTable
      columns={organizationColumns}
      data={data}
      emptyMessage="No organizations match this filter."
      getRowHref={(organization) =>
        organization.itemType === 'request'
          ? `/admin/organization-requests/${organization.id}`
          : organizationHomeRoute(organization.id)
      }
    />
  );
}

export function OrganizationRequestsTable({ data }: { data: OrganizationRequestTableRow[] }) {
  return (
    <DataTable
      columns={requestColumns}
      data={data}
      emptyMessage="No organization requests match this filter."
      getRowHref={(request) => `/admin/organization-requests/${request.id}`}
    />
  );
}
