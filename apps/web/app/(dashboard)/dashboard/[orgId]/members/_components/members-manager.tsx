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
  MemberMinistry,
  OrganizationMembersAccessFilter,
  OrganizationMembersTypeFilter,
} from '@churchflow/shared';
import { MEMBER_MINISTRIES, MEMBER_PAGE_SIZE_OPTIONS } from '@churchflow/shared';
import { QueryFilterMultiSelect } from '@/components/forms/query-filter-multi-select';
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
  memberMinistries,
  memberPage,
  memberPageSize,
  memberSearch,
  memberType,
  manageInvitation,
  ...actions
}: {
  organizationId: string;
  initialPayload: MembersPayload;
  memberAccess: OrganizationMembersAccessFilter;
  memberMinistries: MemberMinistry[];
  memberPage: number;
  memberPageSize: number;
  memberSearch: string;
  memberType: OrganizationMembersTypeFilter;
  manageInvitation: ComponentProps<typeof InviteAppUserForm>['action'];
} & MemberActionProps) {
  const t = useTranslations('members');
  const [inviteFormKey, setInviteFormKey] = useState(0);
  const { data: payload, refresh: refreshMembers } = useMembersQuery({
    access: memberAccess,
    initialPayload,
    ministries: memberMinistries,
    organizationId,
    page: memberPage,
    pageSize: memberPageSize,
    search: memberSearch,
    type: memberType,
  });
  const members = payload.members;
  const canManage = payload.actorRole === 'OWNER' || payload.actorRole === 'ADMIN';
  const isOwner = payload.actorRole === 'OWNER';
  const memberCandidates = payload.memberCandidates;
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
  const memberMinistryFilterOptions = MEMBER_MINISTRIES.map((ministry) => ({
    label: t(`ministry.${ministry}`),
    value: ministry,
  }));
  const preservedAccess = memberAccess === 'all' ? undefined : memberAccess;
  const preservedMinistries = memberMinistries.length > 0 ? memberMinistries.join(',') : undefined;
  const preservedPageSize =
    memberPageSize === MEMBER_PAGE_SIZE_OPTIONS[0] ? undefined : String(memberPageSize);
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
        <div className="flex w-full min-w-0 flex-col gap-2 md:w-[492px] md:max-w-full md:flex-none">
          <MemberSearchInput
            label={t('searchByName')}
            placeholder={t('searchByNamePlaceholder')}
            preserveParams={{
              access: preservedAccess,
              ministries: preservedMinistries,
              pageSize: preservedPageSize,
              type: preservedType,
            }}
            search={memberSearch}
          />
          <QueryFilterMultiSelect
            label={t('ministries')}
            labelClassName="sr-only"
            name="ministries"
            options={memberMinistryFilterOptions}
            placeholder={t('allMinistries')}
            preserveParams={{
              access: preservedAccess,
              pageSize: preservedPageSize,
              search: preservedSearch,
              type: preservedType,
            }}
            selectClassName="w-full"
            value={memberMinistries}
          />
          <div className="filter-bar min-w-0 flex-wrap">
            <QueryFilterSelect
              label={t('access')}
              labelClassName="sr-only"
              name="access"
              options={memberAccessFilterOptions}
              preserveParams={{
                ministries: preservedMinistries,
                pageSize: preservedPageSize,
                search: preservedSearch,
                type: preservedType,
              }}
              size="medium"
              value={memberAccess === 'all' ? '' : memberAccess}
            />
            <QueryFilterSelect
              label={t('type')}
              labelClassName="sr-only"
              name="type"
              options={memberTypeFilterOptions}
              preserveParams={{
                access: preservedAccess,
                ministries: preservedMinistries,
                pageSize: preservedPageSize,
                search: preservedSearch,
              }}
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
          pagination={{
            firstPageLabel: t('firstPage'),
            itemLabel: t('page'),
            lastPageLabel: t('lastPage'),
            nextPageLabel: t('nextPage'),
            ofLabel: t('of'),
            page: payload.pagination.page,
            pageSize: payload.pagination.pageSize,
            pageSizeLabel: t('itemsPerPage'),
            pageSizeOptions: [...MEMBER_PAGE_SIZE_OPTIONS],
            previousPageLabel: t('previousPage'),
            preserveParams: {
              access: preservedAccess,
              ministries: preservedMinistries,
              search: preservedSearch,
              type: preservedType,
            },
            total: payload.pagination.total,
          }}
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
