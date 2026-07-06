'use client';

import Link from 'next/link';
import type { OrganizationRequestStatusItem } from '@churchflow/shared';
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatIsoDate } from '@/lib/format-date';
import { OrganizationRequestActions } from './organization-request-actions';

interface OrganizationRequestStatusTableProps {
  requests: OrganizationRequestStatusItem[];
  hasPendingRequest: boolean;
  onResubmitted: (request: OrganizationRequestStatusItem) => void;
  onDeleted: (requestId: string) => void;
  onNotificationResult: (message: { tone: 'success' | 'warning'; text: string } | null) => void;
}

export function OrganizationRequestStatusTable({
  requests,
  hasPendingRequest,
  onResubmitted,
  onDeleted,
  onNotificationResult,
}: OrganizationRequestStatusTableProps) {
  const columns = useMemo<Array<ColumnDef<OrganizationRequestStatusItem>>>(
    () => [
      {
        accessorKey: 'organizationName',
        header: 'Organization',
        cell: ({ row }) => {
          const request = row.original;

          if (request.status === 'APPROVED' && request.createdOrganization) {
            return (
              <Link
                className="font-bold text-[var(--foreground)] hover:text-[var(--accent)] hover:underline"
                href={`/dashboard/${request.createdOrganization.id}`}
              >
                {request.organizationName}
              </Link>
            );
          }

          return <strong>{request.organizationName}</strong>;
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'createdAt',
        header: 'Submitted',
        cell: ({ row }) => (
          <span className="text-[var(--muted)]">{formatIsoDate(row.original.createdAt)}</span>
        ),
      },
      {
        id: 'details',
        header: 'Details',
        cell: ({ row }) => {
          const request = row.original;

          if (request.status === 'PENDING') {
            return <span className="text-[var(--muted)]">Waiting for platform review</span>;
          }

          if (request.status === 'REJECTED') {
            return (
              <span className="text-[var(--muted)]">
                {request.rejectionReason ?? 'The request was rejected.'}
              </span>
            );
          }

          if (request.status === 'APPROVED') {
            return <span className="text-[var(--muted)]">Approved and ready to open.</span>;
          }

          if (request.status === 'EXPIRED') {
            return (
              <span className="text-[var(--muted)]">Expired request. You can submit it again.</span>
            );
          }

          return null;
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        meta: {
          headerClassName: 'w-16 text-right',
          cellClassName: 'text-right',
        },
        cell: ({ row }) => {
          const request = row.original;
          const canManageRequest =
            request.status === 'PENDING' ||
            request.status === 'APPROVED' ||
            request.status === 'EXPIRED';

          if (!canManageRequest) {
            return null;
          }

          return (
            <div className="flex justify-end">
              <OrganizationRequestActions
                request={request}
                hasPendingRequest={hasPendingRequest}
                onResubmitted={onResubmitted}
                onDeleted={onDeleted}
                onNotificationResult={onNotificationResult}
              />
            </div>
          );
        },
      },
    ],
    [hasPendingRequest, onDeleted, onNotificationResult, onResubmitted],
  );

  return <DataTable columns={columns} data={requests} frameClassName="overflow-visible" />;
}
