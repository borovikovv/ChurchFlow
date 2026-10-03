'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { KnowledgeEntryItem } from '@churchflow/shared';
import { knowledgeListClassNames } from './knowledge-lists.styles';
import type { KnowledgeNotesBrowserProps } from './knowledge-lists.types';
import { KnowledgeNoteRowActions } from './knowledge-note-actions';
import { KnowledgeNoteDetail } from './knowledge-note-detail';
import { KnowledgeNoteList } from './knowledge-note-list';

export function KnowledgeNotesBrowser({
  disabled,
  filtered,
  payload,
  query,
  onDelete,
  onUpdate,
}: KnowledgeNotesBrowserProps) {
  const t = useTranslations('knowledge');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Phones show the list or the open note, never both.
  const [noteOpenOnMobile, setNoteOpenOnMobile] = useState(false);
  const selected = payload.items.find((entry) => entry.id === selectedId) ?? payload.items[0];

  async function deleteNote(entry: KnowledgeEntryItem) {
    await onDelete(entry);
    setNoteOpenOnMobile(false);
  }

  return (
    <div className="grid min-w-0 items-start gap-4 md:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
      <KnowledgeNoteList
        actions={
          payload.canManage
            ? (entry) => (
                <KnowledgeNoteRowActions
                  assignableVisibilities={payload.assignableVisibilities}
                  entry={entry}
                  onDelete={deleteNote}
                  onUpdate={onUpdate}
                />
              )
            : undefined
        }
        className={noteOpenOnMobile ? 'max-md:hidden' : undefined}
        filtered={filtered}
        items={payload.items}
        query={query}
        selectedId={selected?.id}
        onSelect={(entryId) => {
          setSelectedId(entryId);
          setNoteOpenOnMobile(true);
        }}
      />
      <div className={noteOpenOnMobile ? 'min-w-0' : 'min-w-0 max-md:hidden'}>
        {selected ? (
          <KnowledgeNoteDetail
            disabled={disabled}
            entry={selected}
            payload={payload}
            query={query}
            onBack={() => setNoteOpenOnMobile(false)}
            onDelete={deleteNote}
            onUpdate={onUpdate}
          />
        ) : (
          <p className={`${knowledgeListClassNames.panel} m-0 p-6 text-sm`}>
            {filtered ? t('emptyNotesFiltered') : t('emptyNotes')}
          </p>
        )}
      </div>
    </div>
  );
}
