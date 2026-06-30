'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';

export interface OrganizationTableRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  _count?: {
    members: number;
    invitations: number;
  };
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

function formatIsoDate(value: string): string {
  const isoDate = value.slice(0, 10);
  const [year, month, day] = isoDate.split('-');
  return year && month && day ? `${day}.${month}.${year}` : isoDate;
}

const organizationColumns: Array<ColumnDef<OrganizationTableRow>> = [
  {
    accessorKey: 'name',
    header: 'Organization',
    cell: ({ row }) => (
      <div className="table-primary-cell">
        <strong>{row.original.name}</strong>
        <span>{row.original.slug}</span>
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
      getRowHref={(organization) => `/admin/organizations/${organization.id}`}
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
