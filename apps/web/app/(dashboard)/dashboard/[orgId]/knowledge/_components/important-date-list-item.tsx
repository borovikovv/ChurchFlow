'use client';

import type { ImportantDateItem } from '@churchflow/shared';
import { KnowledgeVisibilityBadge } from './knowledge-badges';
import { knowledgeListClassNames, knowledgeListItemClassName } from './knowledge-lists.styles';
import { ImportantDateNextDate, ImportantDateRuleLabel } from './knowledge-meta';

export function ImportantDateListItem({
  date,
  selected,
  onSelect,
}: {
  date: ImportantDateItem;
  selected: boolean;
  onSelect: (dateId: string) => void;
}) {
  return (
    <div className={knowledgeListItemClassName({ selected })}>
      {/* The title button stretches over the whole row, so the row stays one tab stop. */}
      <button
        aria-current={selected ? 'true' : undefined}
        className={`${knowledgeListClassNames.title} cursor-pointer border-0 bg-transparent p-0 text-left text-[var(--foreground)] after:absolute after:inset-0 after:content-[''] focus-visible:outline-none`}
        type="button"
        onClick={() => onSelect(date.id)}
      >
        {date.title}
      </button>
      {date.visibility === 'MEMBERS' ? null : (
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <KnowledgeVisibilityBadge visibility={date.visibility} />
        </span>
      )}
      <span className="text-sm text-[var(--muted)]">
        <ImportantDateRuleLabel date={date} />
      </span>
      <span className="text-xs text-[var(--muted)]">
        <ImportantDateNextDate nextDate={date.nextDate} />
      </span>
    </div>
  );
}
