'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useState, type ComponentProps } from 'react';
import { InviteAppUserForm } from '@/components/members/invite-app-user-form';
import { MemberActions, MemberRoleStatus } from '@/components/members/member-actions';
import { FormDialog } from '@/components/ui/form-dialog';
import { DataTable } from '@/components/ui/data-table';
import type { MembersPayload, OrganizationMember } from '../types';
import { CreateMemberDialog } from './create-member-dialog';
import { MemberCsvActions } from './member-csv-actions';
import { MemberAvatar } from './member-avatar';
import { MemberContactSummary, MemberIdentitySummary } from './member-summary';
import type {
  OrganizationMembersAccessFilter,
  OrganizationMembersTypeFilter,
} from '@churchflow/shared';
import { QueryFilterSelect } from '@/components/forms/query-filter-select';
import { organizationMemberRoute } from '@/features/organizations/routes';
import { useMembersQuery } from '../_hooks/use-members-query';
import { MemberSearchInput } from './member-search-input';

const MEMBERS_ACTION_BUTTON_CLASS_NAME =
  'h-8 min-h-8 max-w-full shrink-0 whitespace-normal px-3 text-center text-sm leading-5 md:whitespace-nowrap';

const MEMBERS_MENU_BUTTON_CLASS_NAME =
  '!h-8 !min-h-8 max-w-full shrink-0 justify-center whitespace-normal px-3 text-center text-sm leading-5 md:whitespace-nowrap';

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
  memberSearch,
  memberType,
  manageInvitation,
  ...actions
}: {
  organizationId: string;
  initialPayload: MembersPayload;
  memberAccess: OrganizationMembersAccessFilter;
  memberSearch: string;
  memberType: OrganizationMembersTypeFilter;
  manageInvitation: ComponentProps<typeof InviteAppUserForm>['action'];
} & MemberActionProps) {
  const t = useTranslations('members');
  const [inviteFormKey, setInviteFormKey] = useState(0);
  const { data: payload, refresh: refreshMembers } = useMembersQuery({
    access: memberAccess,
    initialPayload,
    organizationId,
    search: memberSearch,
    type: memberType,
  });
  const members = payload.members;
  const canManage = payload.actorRole === 'OWNER' || payload.actorRole === 'ADMIN';
  const isOwner = payload.actorRole === 'OWNER';
  const memberCandidates = members.map(({ id, profile }) => ({
    id,
    displayName: profile.displayName,
  }));
  const memberAccessFilterOptions: Array<{
    label: string;
    value: OrganizationMembersAccessFilter | '';
  }> = [
    { label: t('allMembers'), value: '' },
    { label: t('telegramConnected'), value: 'connected' },
    { label: t('noAppAccess'), value: 'offline' },
    { label: t('accessRequested'), value: 'requested' },
    { label: t('suspended'), value: 'suspended' },
  ];
  const memberTypeFilterOptions: Array<{
    label: string;
    value: OrganizationMembersTypeFilter | '';
  }> = [
    { label: t('allTypes'), value: '' },
    { label: t('roleLabels.MEMBER'), value: 'member' },
    { label: t('roleLabels.VIEWER'), value: 'visitor' },
  ];
  const preservedAccess = memberAccess === 'all' ? undefined : memberAccess;
  const preservedType = memberType === 'all' ? undefined : memberType;
  const preservedSearch = memberSearch || undefined;
  const columns: Array<ColumnDef<OrganizationMember>> = [
    {
      accessorFn: (member) => member.profile.displayName,
      header: t('member'),
      cell: ({ row }) => {
        const member = row.original;

        return (
          <div className="flex min-w-0 items-center gap-3">
            <MemberAvatar
              displayName={member.profile.displayName}
              url={member.profile.photoUrl}
              size="md"
            />
            <MemberIdentitySummary source={member.source} profile={member.profile} />
          </div>
        );
      },
    },
    {
      id: 'contact',
      accessorFn: (member) => member.profile.phone ?? member.profile.email ?? '',
      header: t('contact'),
      cell: ({ row }) => <MemberContactSummary profile={row.original.profile} />,
    },
    {
      accessorKey: 'accountState',
      header: t('access'),
      cell: ({ row }) => {
        const member = row.original;

        return (
          <div className="grid min-w-0 gap-[3px]">
            <LocalizedStatusBadge
              status={member.accountState}
              label={t(`statusLabels.${member.accountState}`)}
            />
            {member.activeClaim?.status === 'REQUESTED' ? (
              <small className="truncate text-[var(--muted)]">
                {t('requestedBy', {
                  name: member.activeClaim.requestedBy?.displayName ?? t('telegramUser'),
                })}
              </small>
            ) : null}
          </div>
        );
      },
    },
    {
      accessorKey: 'role',
      header: t('status'),
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
            viewHref={organizationMemberRoute(organizationId, member.id)}
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
      <div className="flex flex-col justify-between gap-3 md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-2 md:max-w-1/3 w-full">
          <MemberSearchInput
            label={t('searchByName')}
            placeholder={t('searchByNamePlaceholder')}
            preserveParams={{ access: preservedAccess, type: preservedType }}
            search={memberSearch}
          />
          <div className="filter-bar min-w-0 flex-wrap">
            <QueryFilterSelect
              label={t('access')}
              labelClassName="sr-only"
              name="access"
              options={memberAccessFilterOptions}
              preserveParams={{ search: preservedSearch, type: preservedType }}
              size="medium"
              value={memberAccess === 'all' ? '' : memberAccess}
            />
            <QueryFilterSelect
              label={t('type')}
              labelClassName="sr-only"
              name="type"
              options={memberTypeFilterOptions}
              preserveParams={{ access: preservedAccess, search: preservedSearch }}
              size="medium"
              value={memberType === 'all' ? '' : memberType}
            />
          </div>
        </div>
        {canManage ? (
          <div className="contents md:flex md:min-w-0 md:flex-nowrap md:items-start md:justify-end md:gap-2">
            <FormDialog
              triggerClassName={`${MEMBERS_ACTION_BUTTON_CLASS_NAME} col-start-1 row-start-2 w-full md:w-auto`}
              triggerLabel={t('inviteAppUser')}
              title={t('inviteTitle')}
              onOpen={() => setInviteFormKey((current) => current + 1)}
            >
              <p className="-mt-4 mb-0">{t('inviteDescription')}</p>
              <InviteAppUserForm
                key={inviteFormKey}
                organizationId={organizationId}
                action={manageInvitation}
              />
            </FormDialog>
            <CreateMemberDialog
              organizationId={organizationId}
              triggerClassName={`${MEMBERS_ACTION_BUTTON_CLASS_NAME} col-start-2 row-start-2 w-full md:w-auto`}
              onCreated={(created) => {
                void created;
                refreshMembers();
              }}
            />
            <MemberCsvActions
              organizationId={organizationId}
              triggerClassName={`${MEMBERS_MENU_BUTTON_CLASS_NAME} w-full md:w-auto`}
              wrapperClassName="flex w-full md:w-auto"
              onImported={() => {
                refreshMembers();
              }}
            />
          </div>
        ) : null}
      </div>

      <section className="stack">
        <h2>{t('organizationMembers')}</h2>
        <DataTable
          columns={columns}
          data={members}
          emptyMessage={t('emptyFilter')}
          getRowHref={(member) => organizationMemberRoute(organizationId, member.id)}
          tableClassName="min-w-[860px]"
        />
      </section>
    </>
  );
}

function LocalizedStatusBadge({ status, label }: { status: string; label: string }) {
  const normalized = status.toLowerCase().replaceAll('_', '-');
  return <span className={`status-badge status-${normalized}`}>{label}</span>;
}
