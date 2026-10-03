'use client';

import { useTranslations } from 'next-intl';
import type { ImportantDateItem } from '@churchflow/shared';
import type { KnowledgePageQuery } from '../knowledge-page-query';
import { ImportantDateListItem } from './important-date-list-item';
import { KnowledgeFilters } from './knowledge-filters';
import { knowledgeListClassNames } from './knowledge-lists.styles';

export function ImportantDateList({
  filtered,
  items,
  query,
  selectedId,
  onSelect,
}: {
  filtered: boolean;
  items: ImportantDateItem[];
  query: KnowledgePageQuery;
  selectedId: string | undefined;
  onSelect: (dateId: string) => void;
}) {
  const t = useTranslations('knowledge');

  return (
    <aside className={`${knowledgeListClassNames.panel} overflow-hidden`}>
      <div className="border-b border-[var(--line-muted)] p-3">
        <KnowledgeFilters query={query} />
      </div>
      {items.length === 0 ? (
        <p className="m-0 p-4 text-sm">{filtered ? t('emptyDatesFiltered') : t('emptyDates')}</p>
      ) : (
        <ul className="m-0 list-none divide-y divide-[var(--line-muted)] p-0">
          {items.map((date) => (
            <li key={date.id}>
              <ImportantDateListItem
                date={date}
                selected={date.id === selectedId}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
