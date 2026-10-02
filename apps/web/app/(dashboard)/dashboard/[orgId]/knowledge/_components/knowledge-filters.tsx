'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { KNOWLEDGE_CATEGORIES } from '@churchflow/shared';
import { QueryFilterSelect } from '@/components/forms/query-filter-select';
import { QuerySearchInput } from '@/components/forms/query-search-input';
import { knowledgePreservedParams, type KnowledgePageQuery } from '../knowledge-page-query';

export function KnowledgeFilters({ query, tags }: { query: KnowledgePageQuery; tags: string[] }) {
  const t = useTranslations('knowledge');
  const preserved = useMemo(() => knowledgePreservedParams(query), [query]);
  const searchPreserved = useMemo(() => ({ ...preserved, search: undefined }), [preserved]);
  const isNotes = query.view === 'notes';

  return (
    <div className="flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
      <QuerySearchInput
        className="md:max-w-80"
        label={isNotes ? t('searchNotesLabel') : t('searchDatesLabel')}
        placeholder={isNotes ? t('searchNotesPlaceholder') : t('searchDatesPlaceholder')}
        preserveParams={searchPreserved}
        search={query.search}
      />
      {isNotes ? (
        <>
          <QueryFilterSelect
            label={t('categoryFilter')}
            name="category"
            options={[
              { value: '', label: t('allCategories') },
              ...KNOWLEDGE_CATEGORIES.map((category) => ({
                value: category,
                label: t(`categories.${category}`),
              })),
            ]}
            preserveParams={{ ...preserved, category: undefined }}
            size="medium"
            value={query.category}
          />
          <QueryFilterSelect
            label={t('tagFilter')}
            name="tag"
            options={[
              { value: '', label: t('allTags') },
              ...tags.map((tag) => ({ value: tag, label: `#${tag}` })),
            ]}
            preserveParams={{ ...preserved, tag: undefined }}
            size="medium"
            value={query.tag}
          />
          <QueryFilterSelect
            label={t('pinnedFilter')}
            name="pinned"
            options={[
              { value: '', label: t('pinnedAll') },
              { value: 'true', label: t('pinnedOnly') },
              { value: 'false', label: t('unpinnedOnly') },
            ]}
            preserveParams={{ ...preserved, pinned: undefined }}
            size="medium"
            value={query.pinned}
          />
        </>
      ) : null}
    </div>
  );
}
