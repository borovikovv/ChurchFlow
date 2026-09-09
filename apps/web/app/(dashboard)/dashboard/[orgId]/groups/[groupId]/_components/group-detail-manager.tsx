'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type {
  AddOrganizationGroupMembersInput,
  CreateOrganizationGroupInput,
  OrganizationGroupDetailPayload,
  OrganizationGroupMemberItem,
} from '@churchflow/shared';
import { Avatar } from '@/components/ui/avatar';
import { Button, ButtonLink } from '@/components/ui/button';
import { GroupBadge } from '@/features/groups/components/group-badge';
import { organizationGroupsRoute, organizationMemberRoute } from '@/features/organizations/routes';
import Link from 'next/link';
import {
  addGroupMembersAction,
  removeGroupMemberAction,
  updateGroupAction,
  updateGroupMemberAction,
} from '../../actions';
import { GroupFormDialog } from '../../_components/group-form-dialog';
import { GroupMemberFormDialog } from './group-member-form-dialog';

export function GroupDetailManager({
  initialPayload,
  organizationId,
}: {
  initialPayload: OrganizationGroupDetailPayload;
  organizationId: string;
}) {
  const t = useTranslations('groups');
  const commonT = useTranslations('common');
  const [group, setGroup] = useState(initialPayload.group);
  const [error, setError] = useState<string | null>(null);
  const canManage = initialPayload.canManage;
  const memberIds = new Set(group.members.map((member) => member.membershipId));
  const candidates = initialPayload.memberCandidates.filter(
    (candidate) => !memberIds.has(candidate.id),
  );
  const leaders = group.members.filter((member) => member.role === 'LEADER');

  const updateGroup = async (updates: CreateOrganizationGroupInput) => {
    const result = await updateGroupAction({ organizationId, groupId: group.id, group: updates });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError(null);
    setGroup(result.group);
  };

  const addMember = async (member: AddOrganizationGroupMembersInput['members'][number]) => {
    const result = await addGroupMembersAction({
      organizationId,
      groupId: group.id,
      members: [member],
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError(null);
    setGroup(result.group);
  };

  const toggleLeader = async (member: OrganizationGroupMemberItem) => {
    const result = await updateGroupMemberAction({
      organizationId,
      groupId: group.id,
      membershipId: member.membershipId,
      member: { role: member.role === 'LEADER' ? 'MEMBER' : 'LEADER' },
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError(null);
    setGroup(result.group);
  };

  const removeMember = async (member: OrganizationGroupMemberItem) => {
    const result = await removeGroupMemberAction({
      organizationId,
      groupId: group.id,
      membershipId: member.membershipId,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError(null);
    setGroup(result.group);
  };

  return (
    <div className="stack">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <ButtonLink
          className="w-full sm:w-auto"
          href={organizationGroupsRoute(organizationId)}
          variant="secondary"
        >
          {t('backToGroups')}
        </ButtonLink>
        {canManage ? (
          <GroupFormDialog
            group={group}
            title={t('editTitle')}
            triggerLabel={t('edit')}
            triggerVariant="secondary"
            submitLabel={commonT('save')}
            onSubmit={(updates, closeDialog) => {
              void updateGroup(updates);
              closeDialog();
            }}
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <GroupBadge group={group} />
          {group.description ? (
            <p className="mt-2 mb-0 text-[var(--muted)]">{group.description}</p>
          ) : null}
        </div>
        {canManage ? (
          <GroupMemberFormDialog
            candidates={candidates}
            onSubmit={(member, closeDialog) => {
              void addMember(member);
              closeDialog();
            }}
          />
        ) : null}
      </div>
      {error ? <p className="form-error">{error}</p> : null}

      <section className="stack min-w-0">
        <h2>{t('leaders')}</h2>
        {leaders.length > 0 ? (
          <ul className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-2 p-0">
            {leaders.map((leader) => (
              <li className="min-w-0" key={leader.membershipId}>
                <Link
                  className="min-w-0 font-semibold"
                  href={organizationMemberRoute(organizationId, leader.membershipId)}
                >
                  {leader.displayName}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[var(--muted)]">{t('noLeaders')}</p>
        )}
      </section>

      <section className="stack min-w-0">
        <h2>{t('members')}</h2>
        {group.members.length === 0 ? (
          <div className="table-empty-state">{t('noMembers')}</div>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {group.members.map((member) => (
              <li
                className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3"
                key={member.membershipId}
              >
                <Avatar displayName={member.displayName} url={member.photoUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <Link
                    className="font-semibold"
                    href={organizationMemberRoute(organizationId, member.membershipId)}
                  >
                    {member.displayName}
                  </Link>
                  <p className="m-0 truncate text-sm text-[var(--muted)]">
                    {member.responsibility ?? t('noResponsibility')}
                  </p>
                </div>
                <span className="status-badge">{t(`roles.${member.role}`)}</span>
                {canManage ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        void toggleLeader(member);
                      }}
                    >
                      {member.role === 'LEADER' ? t('demoteLeader') : t('promoteLeader')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        void removeMember(member);
                      }}
                    >
                      {t('removeMember')}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
