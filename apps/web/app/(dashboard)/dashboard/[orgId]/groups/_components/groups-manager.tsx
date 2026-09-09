'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type {
  CreateOrganizationGroupInput,
  OrganizationGroupListItem,
  OrganizationGroupsPayload,
} from '@churchflow/shared';
import { CardList } from '@/components/ui/card-list';
import { DataTable } from '@/components/ui/data-table';
import { GroupBadge } from '@/features/groups/components/group-badge';
import { organizationGroupRoute } from '@/features/organizations/routes';
import {
  createGroupAction,
  deleteGroupAction,
  updateGroupAction,
} from '../actions';
import { GroupCard } from './group-card';
import { GroupFormDialog } from './group-form-dialog';
import { GroupRowActions } from './group-row-actions';
import { GroupsCsvExport } from './groups-csv-export';

export function GroupsManager({
  initialPayload,
  organizationId,
}: {
  initialPayload: OrganizationGroupsPayload;
  organizationId: string;
}) {
  const t = useTranslations('groups');
  const commonT = useTranslations('common');
  const [groups, setGroups] = useState(initialPayload.groups);
  const [error, setError] = useState<string | null>(null);
  const canManage = initialPayload.canManage;

  const createGroup = async (group: CreateOrganizationGroupInput) => {
    const result = await createGroupAction({ organizationId, group });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError(null);
    setGroups((current) =>
      sortByName([
        ...current,
        {
          id: result.group.id,
          name: result.group.name,
          description: result.group.description,
          icon: result.group.icon,
          color: result.group.color,
          memberCount: result.group.members.length,
          leaders: [],
        },
      ]),
    );
  };

  const updateGroup = async (groupId: string, group: CreateOrganizationGroupInput) => {
    const result = await updateGroupAction({ organizationId, groupId, group });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError(null);
    setGroups((current) =>
      sortByName(
        current.map((item) =>
          item.id === groupId
            ? {
                ...item,
                name: result.group.name,
                description: result.group.description,
                icon: result.group.icon,
                color: result.group.color,
              }
            : item,
        ),
      ),
    );
  };

  const deleteGroup = async (group: OrganizationGroupListItem) => {
    const result = await deleteGroupAction({ organizationId, groupId: group.id });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError(null);
    setGroups((current) => current.filter((item) => item.id !== group.id));
  };

  const renderGroupActions = (group: OrganizationGroupListItem) =>
    canManage ? (
      <GroupRowActions
        group={group}
        onDelete={deleteGroup}
        onUpdate={(groupId, updates) => {
          void updateGroup(groupId, updates);
        }}
      />
    ) : null;

  const columns: Array<ColumnDef<OrganizationGroupListItem>> = [
    {
      accessorKey: 'name',
      header: t('group'),
      cell: ({ row }) => <GroupBadge group={row.original} />,
    },
    {
      accessorKey: 'description',
      header: t('descriptionLabel'),
      cell: ({ row }) => (
        <span className="line-clamp-2 text-[var(--muted)]">{row.original.description ?? '—'}</span>
      ),
    },
    {
      id: 'leaders',
      accessorFn: (group) => group.leaders.map((leader) => leader.displayName).join(', '),
      header: t('leaders'),
      cell: ({ row }) => (
        <span className="truncate">
          {row.original.leaders.length > 0
            ? row.original.leaders.map((leader) => leader.displayName).join(', ')
            : t('noLeaders')}
        </span>
      ),
    },
    {
      accessorKey: 'memberCount',
      header: t('members'),
      meta: { headerClassName: 'w-24', cellClassName: 'w-24' },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => renderGroupActions(row.original),
      meta: { headerClassName: 'w-11', cellClassName: 'w-11' },
    },
  ];

  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 className="m-0">{t('organizationGroups')}</h2>
        <div className="flex items-center gap-2">
          <GroupsCsvExport groups={groups} organizationId={organizationId} />
          {canManage ? (
            <GroupFormDialog
              title={t('createTitle')}
              triggerLabel={t('createGroup')}
              submitLabel={commonT('save')}
              onSubmit={(group, closeDialog) => {
                void createGroup(group);
                closeDialog();
              }}
            />
          ) : null}
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}

      <div className="md:hidden">
        <CardList
          data={groups}
          emptyMessage={t('empty')}
          getCardKey={(group) => group.id}
          renderCard={(group) => (
            <GroupCard
              actions={renderGroupActions(group)}
              group={group}
              viewHref={organizationGroupRoute(organizationId, group.id)}
            />
          )}
        />
      </div>
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={groups}
          emptyMessage={t('empty')}
          getRowHref={(group) => organizationGroupRoute(organizationId, group.id)}
          tableClassName="min-w-[720px]"
        />
      </div>
    </>
  );
}

function sortByName(groups: OrganizationGroupListItem[]): OrganizationGroupListItem[] {
  return [...groups].sort((left, right) => left.name.localeCompare(right.name));
}
