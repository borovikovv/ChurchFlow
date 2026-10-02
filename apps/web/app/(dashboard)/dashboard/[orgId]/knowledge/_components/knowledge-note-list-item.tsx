'use client';

import type { KnowledgeEntryItem } from '@churchflow/shared';
import { PinIcon } from '@/components/icons/action-icons';
import { RichTextContent } from '@/components/ui/rich-text-content';
import { KnowledgeCategoryBadge, KnowledgeVisibilityBadge } from './knowledge-badges';
import { knowledgeListClassNames, knowledgeNoteListItemClassName } from './knowledge-lists.styles';
import { KnowledgeDate } from './knowledge-meta';

export function KnowledgeNoteListItem({
  entry,
  selected,
  onSelect,
}: {
  entry: KnowledgeEntryItem;
  selected: boolean;
  onSelect: (entryId: string) => void;
}) {
  return (
    <div className={knowledgeNoteListItemClassName({ selected })}>
      <span className="flex min-w-0 items-start justify-between gap-2">
        {/* The title button stretches over the whole row, so the row stays one tab stop. */}
        <button
          aria-current={selected ? 'true' : undefined}
          className={`${knowledgeListClassNames.title} cursor-pointer border-0 bg-transparent p-0 text-left text-[var(--foreground)] after:absolute after:inset-0 after:content-[''] focus-visible:outline-none`}
          type="button"
          onClick={() => onSelect(entry.id)}
        >
          {entry.title}
        </button>
        {entry.pinned ? <PinIcon className="h-4 w-4 text-[var(--accent)]" filled /> : null}
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <KnowledgeCategoryBadge category={entry.category} />
        {entry.visibility === 'MEMBERS' ? null : (
          <KnowledgeVisibilityBadge visibility={entry.visibility} />
        )}
      </span>
      <RichTextContent html={entry.content} intent="preview" />
      <span className="text-xs text-[var(--muted)]">
        <KnowledgeDate value={entry.updatedAt} />
      </span>
    </div>
  );
}
