'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { ComponentProps } from 'react';
import { InviteAppUserForm } from '@/components/members/invite-app-user-form';
import { MemberActions, MemberRoleStatus } from '@/components/members/member-actions';
import { FormDialog } from '@/components/ui/form-dialog';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import type { MembersPayload, OrganizationMember } from '../types';
import { CreateMemberDialog } from './create-member-dialog';
import { MemberCsvActions } from './member-csv-actions';
import { MemberAvatar } from './member-avatar';
import { MemberContactSummary, MemberIdentitySummary } from './member-summary';
import type { OrganizationMembersAccessFilter } from '@churchflow/shared';
import { QueryFilterSelect } from '@/components/forms/query-filter-select';
import { useMembersQuery } from '../_hooks/use-members-query';

const MEMBERS_ACTION_BUTTON_CLASS_NAME = 'h-[42px] min-h-[42px]';

const MEMBER_ACCESS_FILTER_OPTIONS: Array<{
  label: string;
  value: OrganizationMembersAccessFilter | '';
}> = [
  { label: 'All members', value: '' },
  { label: 'Telegram connected', value: 'connected' },
  { label: 'No app access', value: 'offline' },
  { label: 'Access requested', value: 'requested' },
  { label: 'Suspended', value: 'suspended' },
];

type MemberActionProps = Pick<
  ComponentProps<typeof MemberActions>,
  | 'updateProfile'
  | 'updateRole'
  | 'removeMember'
  | 'claimAction'
  | 'createRelationship'
  | 'deleteRelationship'
  | 'preparePhoto'
  | 'confirmPhoto'
>;

export function MembersManager({
  organizationId,
  initialPayload,
  memberAccess,
  manageInvitation,
  ...actions
}: {
  organizationId: string;
  initialPayload: MembersPayload;
  memberAccess: OrganizationMembersAccessFilter;
  manageInvitation: ComponentProps<typeof InviteAppUserForm>['action'];
} & MemberActionProps) {
  const { data: payload, refresh: refreshMembers } = useMembersQuery({
    access: memberAccess,
    initialPayload,
    organizationId,
  });
  const members = payload.members;
  const canManage = payload.actorRole === 'OWNER' || payload.actorRole === 'ADMIN';
  const isOwner = payload.actorRole === 'OWNER';
  const memberCandidates = members.map(({ id, profile }) => ({
    id,
    displayName: profile.displayName,
  }));
  const columns: Array<ColumnDef<OrganizationMember>> = [
    {
      accessorFn: (member) => member.profile.displayName,
      header: 'Member',
      cell: ({ row }) => {
        const member = row.original;

        return (
          <div className="flex min-w-0 items-center gap-3">
            <MemberAvatar displayName={member.profile.displayName} url={member.profile.photoUrl} />
            <MemberIdentitySummary source={member.source} profile={member.profile} />
          </div>
        );
      },
    },
    {
      id: 'contact',
      accessorFn: (member) => member.profile.email ?? member.profile.phone ?? '',
      header: 'Contact',
      cell: ({ row }) => <MemberContactSummary profile={row.original.profile} />,
    },
    {
      accessorKey: 'accountState',
      header: 'Access',
      cell: ({ row }) => {
        const member = row.original;

        return (
          <div className="grid min-w-0 gap-[3px]">
            <StatusBadge status={member.accountState} />
            {member.activeClaim?.status === 'REQUESTED' ? (
              <small className="truncate text-[var(--muted)]">
                Requested by {member.activeClaim.requestedBy?.displayName ?? 'Telegram user'}
              </small>
            ) : null}
          </div>
        );
      },
    },
    {
      accessorKey: 'role',
      header: 'Status',
      cell: ({ row }) => <MemberRoleStatus role={row.original.role} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const member = row.original;

        return (
          <MemberActions
            {...actions}
            member={member}
            organizationId={organizationId}
            canManage={canManage}
            isOwner={isOwner}
            isCurrentMember={member.id === payload.actorMembershipId}
            memberCandidates={memberCandidates}
            onProfileUpdated={(updates) => {
              void updates;
              refreshMembers();
            }}
            onRoleUpdated={(role) => {
              void role;
              refreshMembers();
            }}
            onRemoved={() => {
              refreshMembers();
            }}
          />
        );
      },
      meta: {
        headerClassName: 'w-11',
        cellClassName: 'w-11',
      },
    },
  ];

  return (
    <>
      <div className="flex justify-between py-2">
        <div className="filter-bar">
          <QueryFilterSelect
            label="Access"
            name="access"
            options={MEMBER_ACCESS_FILTER_OPTIONS}
            value={memberAccess === 'all' ? '' : memberAccess}
          />
        </div>
        {canManage ? (
          <div className="flex items-start justify-end gap-2">
            <FormDialog
              triggerClassName={MEMBERS_ACTION_BUTTON_CLASS_NAME}
              triggerLabel="Invite app user"
              title="Invite an app user"
            >
              <p className="-mt-4 mb-0">
                Send an email invitation or generate a link you can share yourself.
              </p>
              <InviteAppUserForm organizationId={organizationId} action={manageInvitation} />
            </FormDialog>
            <CreateMemberDialog
              organizationId={organizationId}
              triggerClassName={MEMBERS_ACTION_BUTTON_CLASS_NAME}
              onCreated={(created) => {
                void created;
                refreshMembers();
              }}
            />
            <MemberCsvActions
              organizationId={organizationId}
              onImported={() => {
                refreshMembers();
              }}
            />
          </div>
        ) : null}
      </div>

      <section className="stack">
        <h2>Organization members</h2>
        <DataTable columns={columns} data={members} emptyMessage="No members match this filter." />
      </section>
    </>
  );
}
