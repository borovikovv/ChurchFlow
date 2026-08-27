'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import type { ComponentProps } from 'react';
import { InviteAppUserForm } from '@/components/members/invite-app-user-form';
import { MemberActions, MemberRoleStatus } from '@/components/members/member-actions';
import { DataTable } from '@/components/ui/data-table';
import { createDataTablePagination } from '@/components/ui/data-table-pagination';
import { Tabs } from '@/components/ui/tabs';
import type { MembersPayload, OrganizationMember } from '../types';
import type { MembersFiltersProps } from './members-filters.types';
import { MemberCard } from './member-card';
import { MembersActions } from './members-actions';
import { MembersCardList } from './members-card-list';
import { MembersFilters } from './members-filters';
import { Avatar } from '@/components/ui/avatar';
import {
  MemberAccessMethodsSummary,
  MemberContactSummary,
  MemberIdentitySummary,
} from './member-summary';
import type {
  MemberMinistry,
  OrganizationMembersAccessFilter,
  OrganizationMembersTab,
  OrganizationMembersTypeFilter,
} from '@churchflow/shared';
import { MEMBER_MINISTRIES, MEMBER_PAGE_SIZE_OPTIONS } from '@churchflow/shared';
import { organizationMemberRoute } from '@/features/organizations/routes';
import { useMembersQuery } from '../_hooks/use-members-query';
import { MemberSearchInput } from './member-search-input';

type MemberActionProps = Pick<
  ComponentProps<typeof MemberActions>,
  | 'updateProfile'
  | 'updateRole'
  | 'archiveMember'
  | 'removeMember'
  | 'restoreMember'
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
  memberTab,
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
  memberTab: OrganizationMembersTab;
  memberType: OrganizationMembersTypeFilter;
  manageInvitation: ComponentProps<typeof InviteAppUserForm>['action'];
} & MemberActionProps) {
  const t = useTranslations('members');
  const paginationT = useTranslations('pagination');
  const { data: payload, refresh: refreshMembers } = useMembersQuery({
    access: memberAccess,
    initialPayload,
    ministries: memberMinistries,
    organizationId,
    page: memberPage,
    pageSize: memberPageSize,
    search: memberSearch,
    tab: memberTab,
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
    { label: t('emailConnected'), value: 'email' },
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
  const preservedAccess =
    memberAccess === 'all' || memberTab === 'archived' ? undefined : memberAccess;
  const preservedMinistries = memberMinistries.length > 0 ? memberMinistries.join(',') : undefined;
  const preservedPageSize =
    memberPageSize === MEMBER_PAGE_SIZE_OPTIONS[0] ? undefined : String(memberPageSize);
  const preservedTab = memberTab === 'archived' ? memberTab : undefined;
  const preservedType = memberType === 'all' ? undefined : memberType;
  const preservedSearch = memberSearch || undefined;
  const activeMembersHref = createMembersTabHref(organizationId, {
    access: preservedAccess,
    ministries: preservedMinistries,
    pageSize: preservedPageSize,
    search: preservedSearch,
    type: preservedType,
  });
  const archivedMembersHref = createMembersTabHref(organizationId, {
    ministries: preservedMinistries,
    pageSize: preservedPageSize,
    search: preservedSearch,
    tab: 'archived',
    type: preservedType,
  });
  const renderMemberActions = (member: OrganizationMember) => (
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
  const membersQuery = {
    organizationId,
    access: memberAccess,
    ministries: memberMinistries,
    page: memberPage,
    pageSize: memberPageSize,
    search: memberSearch,
    tab: memberTab,
    type: memberType,
  };
  const membersCardListKey = [
    memberAccess,
    memberMinistries.join('|'),
    memberPage,
    memberPageSize,
    memberSearch,
    memberTab,
    memberType,
  ].join(':');
  const membersPagination = createDataTablePagination({
    labels: {
      firstPageLabel: paginationT('firstPage'),
      itemLabel: paginationT('page'),
      lastPageLabel: paginationT('lastPage'),
      nextPageLabel: paginationT('nextPage'),
      ofLabel: paginationT('of'),
      pageSizeLabel: paginationT('itemsPerPage'),
      previousPageLabel: paginationT('previousPage'),
    },
    page: payload.pagination.page,
    pageSize: payload.pagination.pageSize,
    pageSizeOptions: [...MEMBER_PAGE_SIZE_OPTIONS],
    preserveParams: {
      access: preservedAccess,
      ministries: preservedMinistries,
      search: preservedSearch,
      tab: preservedTab,
      type: preservedType,
    },
    total: payload.pagination.total,
  });
  const columns: Array<ColumnDef<OrganizationMember>> = [
    {
      accessorFn: (member) => member.profile.displayName,
      header: t('member'),
      cell: ({ row }) => {
        const member = row.original;

        return (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              displayName={member.profile.displayName}
              url={member.profile.photoUrl}
              size="md"
            />
            <MemberIdentitySummary
              archived={member.status === 'ARCHIVED'}
              source={member.source}
              profile={member.profile}
            />
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
            <MemberAccessMethodsSummary methods={member.accessMethods} />
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
      cell: ({ row }) => renderMemberActions(row.original),
      meta: {
        headerClassName: 'w-11',
        cellClassName: 'w-11',
      },
    },
  ];

  const filterProps = {
    accessOptions: memberAccessFilterOptions,
    accessValue: memberAccess === 'all' ? '' : memberAccess,
    ministryOptions: memberMinistryFilterOptions,
    ministryValue: memberMinistries,
    preserved: {
      access: preservedAccess,
      ministries: preservedMinistries,
      pageSize: preservedPageSize,
      search: preservedSearch,
      tab: preservedTab,
      type: preservedType,
    },
    showAccessFilter: memberTab === 'active',
    typeOptions: memberTypeFilterOptions,
    typeValue: memberType === 'all' ? '' : memberType,
  } satisfies Omit<MembersFiltersProps, 'variant'>;

  return (
    <>
      <div className="flex min-w-0 flex-col justify-between gap-3 xl:flex-row">
        <div className="flex w-full min-w-0 flex-col gap-2 md:w-[492px] md:max-w-full md:flex-none">
          <div className="flex min-w-0 items-center justify-between gap-2 md:contents">
            <Tabs
              label={t('memberTabsLabel')}
              items={[
                {
                  label: t('activeMembers'),
                  href: activeMembersHref,
                  active: memberTab === 'active',
                  count: payload.counts.active,
                },
                {
                  label: t('archivedMembers'),
                  href: archivedMembersHref,
                  active: memberTab === 'archived',
                  count: payload.counts.archived,
                },
              ]}
            />
            <MembersFilters {...filterProps} variant="sheet" />
          </div>
          <MemberSearchInput
            className="order-first md:order-none"
            label={t('searchByName')}
            placeholder={t('searchByNamePlaceholder')}
            preserveParams={{
              access: preservedAccess,
              ministries: preservedMinistries,
              pageSize: preservedPageSize,
              tab: preservedTab,
              type: preservedType,
            }}
            search={memberSearch}
          />
          <MembersFilters {...filterProps} variant="inline" />
        </div>
        {canManage ? (
          <MembersActions
            manageInvitation={manageInvitation}
            organizationId={organizationId}
            variant="toolbar"
          />
        ) : null}
      </div>

      <section className="stack min-w-0">
        <h2>{t('organizationMembers')}</h2>
        <div className="md:hidden">
          <MembersCardList
            emptyMessage={t('emptyFilter')}
            key={membersCardListKey}
            payload={payload}
            query={membersQuery}
            renderCard={(member) => (
              <MemberCard
                actions={renderMemberActions(member)}
                member={member}
                viewHref={organizationMemberRoute(organizationId, member.id)}
              />
            )}
          />
        </div>
        <div className="hidden md:block">
          <DataTable
            columns={columns}
            data={members}
            emptyMessage={t('emptyFilter')}
            getRowHref={(member) => organizationMemberRoute(organizationId, member.id)}
            getRowClassName={(member) => (member.status === 'ARCHIVED' ? 'opacity-75' : undefined)}
            pagination={membersPagination}
            tableClassName="min-w-[860px]"
          />
        </div>
      </section>
    </>
  );
}

function createMembersTabHref(organizationId: string, params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([name, value]) => {
    if (value) searchParams.set(name, value);
  });
  const query = searchParams.toString();
  return query
    ? `/dashboard/${organizationId}/members?${query}`
    : `/dashboard/${organizationId}/members`;
}

function LocalizedStatusBadge({ status, label }: { status: string; label: string }) {
  const normalized = status.toLowerCase().replaceAll('_', '-');
  return <span className={`status-badge status-${normalized}`}>{label}</span>;
}
