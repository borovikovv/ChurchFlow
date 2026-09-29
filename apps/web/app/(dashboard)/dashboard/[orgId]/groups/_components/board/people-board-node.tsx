'use client';

import type { NodeProps } from '@xyflow/react';
import { useTranslations } from 'next-intl';
import type { PeopleBoardNode } from './board.types';
import { BoardDropZone } from './board-drop-zone';
import { BoardMemberRow } from './board-member-row';
import {
  boardMemberListClassName,
  boardNodeClassName,
  boardNodeHeaderClassName,
} from './board-node.styles';

export function PeopleBoardNodeView({ data }: NodeProps<PeopleBoardNode>) {
  const t = useTranslations('groups.board');
  const { nodeKey, people } = data;
  const title = nodeKey === 'visitors' ? t('visitors') : t('unassigned');

  return (
    <article className={`${boardNodeClassName} border-dashed`}>
      <header className={boardNodeHeaderClassName}>
        <h3 className="m-0 truncate text-sm font-semibold">{title}</h3>
        <span className="shrink-0 text-xs text-[var(--muted)]">
          {t('peopleCount', { count: people.length })}
        </span>
      </header>

      <BoardDropZone hint={t('dropToRemove')} label={title} target={{ kind: 'people', nodeKey }}>
        {people.length === 0 ? (
          <p className="m-0 px-1.5 text-xs text-[var(--muted)]">{t('noPeople')}</p>
        ) : (
          <ul className={`${boardMemberListClassName} max-h-96`}>
            {people.map((person) => (
              <BoardMemberRow
                key={person.membershipId}
                photoUrl={person.photoUrl}
                source={{
                  kind: 'people',
                  nodeKey,
                  membershipId: person.membershipId,
                  displayName: person.displayName,
                }}
              />
            ))}
          </ul>
        )}
      </BoardDropZone>
    </article>
  );
}
