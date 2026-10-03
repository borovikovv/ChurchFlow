'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ImportantDateDetail } from './important-date-detail';
import { ImportantDateList } from './important-date-list';
import { knowledgeListClassNames } from './knowledge-lists.styles';
import type { ImportantDatesBrowserProps } from './knowledge-lists.types';

export function ImportantDatesBrowser({
  filtered,
  payload,
  query,
  onDelete,
  onUpdate,
}: ImportantDatesBrowserProps) {
  const t = useTranslations('knowledge');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = payload.items.find((date) => date.id === selectedId) ?? payload.items[0];

  return (
    <div className="grid min-w-0 grid-cols-[minmax(280px,360px)_minmax(0,1fr)] items-start gap-4">
      <ImportantDateList
        filtered={filtered}
        items={payload.items}
        query={query}
        selectedId={selected?.id}
        onSelect={setSelectedId}
      />
      <div className="min-w-0">
        {selected ? (
          <ImportantDateDetail
            date={selected}
            payload={payload}
            onDelete={onDelete}
            onUpdate={onUpdate}
          />
        ) : (
          <p className={`${knowledgeListClassNames.panel} m-0 p-6 text-sm`}>
            {filtered ? t('emptyDatesFiltered') : t('emptyDates')}
          </p>
        )}
      </div>
    </div>
  );
}
