'use client';

import { useTranslations } from 'next-intl';
import type { KnowledgeEntryItem } from '@churchflow/shared';
import { CardList } from '@/components/ui/card-list';
import { RichTextContent } from '@/components/ui/rich-text-content';
import { KnowledgeAuthorMeta } from './knowledge-meta';
import { KnowledgeNoteActions } from './knowledge-note-actions';
import { KnowledgeNoteSummary } from './knowledge-note-summary';
import type { KnowledgeNotesListProps } from './knowledge-lists.types';

const getEntryKey = (entry: KnowledgeEntryItem) => entry.id;

export function KnowledgeNotesCardList({
  disabled,
  filtered,
  payload,
  onDelete,
  onUpdate,
}: KnowledgeNotesListProps) {
  const t = useTranslations('knowledge');

  return (
    <CardList
      data={payload.items}
      emptyMessage={filtered ? t('emptyNotesFiltered') : t('emptyNotes')}
      getCardKey={getEntryKey}
      renderCard={(entry) => (
        <>
          <div className="flex min-w-0 items-start justify-between gap-2">
            <KnowledgeNoteSummary entry={entry} />
            {payload.canManage ? (
              <KnowledgeNoteActions
                assignableVisibilities={payload.assignableVisibilities}
                disabled={disabled}
                entry={entry}
                onDelete={onDelete}
                onUpdate={onUpdate}
              />
            ) : null}
          </div>
          <details className="group min-w-0">
            <summary className="cursor-pointer text-sm font-medium text-[var(--accent-strong)]">
              {t('showNote')}
            </summary>
            <RichTextContent className="mt-2" html={entry.content} />
          </details>
          <div className="flex min-w-0 flex-wrap items-end justify-between gap-2">
            <KnowledgeAuthorMeta
              createdAt={entry.createdAt}
              createdBy={entry.createdBy}
              updatedAt={entry.updatedAt}
              updatedBy={entry.updatedBy}
            />
            <span className="text-xs text-[var(--muted)]">
              {t(`visibilities.${entry.visibility}`)}
            </span>
          </div>
        </>
      )}
    />
  );
}
