'use client';

import type { NodeProps } from '@xyflow/react';
import { useTranslations } from 'next-intl';
import { GroupBadge } from '@/features/groups/components/group-badge';
import type { GroupBoardNode } from './board.types';
import { BoardDropZone } from './board-drop-zone';
import { BoardMemberRow } from './board-member-row';
import {
  boardMemberListClassName,
  boardNodeClassName,
  boardNodeHeaderClassName,
} from './board-node.styles';

export function GroupBoardNodeView({ data }: NodeProps<GroupBoardNode>) {
  const t = useTranslations('groups');
  const { group } = data;
  const leaders = group.members.filter((member) => member.role === 'LEADER');
  const members = group.members.filter((member) => member.role !== 'LEADER');

  return (
    <article className={boardNodeClassName}>
      <header className={boardNodeHeaderClassName}>
        <GroupBadge group={group} />
        <span className="shrink-0 text-xs text-[var(--muted)]">
          {t('board.peopleCount', { count: group.members.length })}
        </span>
      </header>

      <BoardDropZone
        hint={t('board.dropToLead')}
        label={t('leaders')}
        target={{ kind: 'group', groupId: group.id, zone: 'leaders' }}
      >
        {leaders.length === 0 ? (
          <p className="m-0 px-1.5 text-xs text-[var(--muted)]">{t('noLeaders')}</p>
        ) : (
          <ul className={`${boardMemberListClassName} max-h-32`}>
            {leaders.map((member) => (
              <BoardMemberRow
                key={member.membershipId}
                photoUrl={member.photoUrl}
                roleLabel={t('roles.LEADER')}
                source={{
                  kind: 'group',
                  groupId: group.id,
                  membershipId: member.membershipId,
                  role: member.role,
                  displayName: member.displayName,
                }}
              />
            ))}
          </ul>
        )}
      </BoardDropZone>

      <BoardDropZone
        hint={t('board.dropToJoin')}
        label={t('members')}
        target={{ kind: 'group', groupId: group.id, zone: 'members' }}
      >
        {members.length === 0 ? (
          <p className="m-0 px-1.5 text-xs text-[var(--muted)]">{t('board.noPeople')}</p>
        ) : (
          <ul className={`${boardMemberListClassName} max-h-52`}>
            {members.map((member) => (
              <BoardMemberRow
                key={member.membershipId}
                photoUrl={member.photoUrl}
                source={{
                  kind: 'group',
                  groupId: group.id,
                  membershipId: member.membershipId,
                  role: member.role,
                  displayName: member.displayName,
                }}
              />
            ))}
          </ul>
        )}
      </BoardDropZone>
    </article>
  );
}
