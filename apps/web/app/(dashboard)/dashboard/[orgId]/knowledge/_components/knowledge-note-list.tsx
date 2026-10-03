'use client';

import { useTranslations } from 'next-intl';
import type { KnowledgeEntryItem } from '@churchflow/shared';
import type { KnowledgePageQuery } from '../knowledge-page-query';
import { KnowledgeFilters } from './knowledge-filters';
import { knowledgeListClassNames } from './knowledge-lists.styles';
import { KnowledgeNoteListItem } from './knowledge-note-list-item';

interface NoteGroup {
  key: string;
  heading: string | null;
  items: KnowledgeEntryItem[];
}

export function KnowledgeNoteList({
  className,
  filtered,
  items,
  query,
  selectedId,
  onSelect,
}: {
  className?: string | undefined;
  filtered: boolean;
  items: KnowledgeEntryItem[];
  query: KnowledgePageQuery;
  selectedId: string | undefined;
  onSelect: (entryId: string) => void;
}) {
  const t = useTranslations('knowledge');
  const pinned = items.filter((entry) => entry.pinned);
  const others = items.filter((entry) => !entry.pinned);
  // Headings only help when the list mixes pinned and other notes.
  const groups: NoteGroup[] =
    pinned.length > 0 && others.length > 0
      ? [
          { key: 'pinned', heading: t('pinnedSection'), items: pinned },
          { key: 'others', heading: t('allNotesSection'), items: others },
        ]
      : [{ key: 'all', heading: null, items }];

  return (
    <aside className={[knowledgeListClassNames.listPanel, className].filter(Boolean).join(' ')}>
      <div className="max-md:pb-4 md:border-b md:border-[var(--line-muted)] md:p-3">
        <KnowledgeFilters query={query} />
      </div>
      {items.length === 0 ? (
        <p className="m-0 text-sm md:p-4">{filtered ? t('emptyNotesFiltered') : t('emptyNotes')}</p>
      ) : (
        groups.map((group) => (
          <section key={group.key}>
            {group.heading ? (
              <h2 className={knowledgeListClassNames.sectionHeading}>{group.heading}</h2>
            ) : null}
            <ul className="m-0 grid list-none gap-2 p-0 md:gap-0 md:divide-y md:divide-[var(--line-muted)]">
              {group.items.map((entry) => (
                <li key={entry.id}>
                  <KnowledgeNoteListItem
                    entry={entry}
                    selected={entry.id === selectedId}
                    onSelect={onSelect}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </aside>
  );
}
