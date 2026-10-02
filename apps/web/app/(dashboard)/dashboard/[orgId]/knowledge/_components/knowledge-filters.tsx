'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { KNOWLEDGE_CATEGORIES } from '@churchflow/shared';
import { QueryFilterSelect } from '@/components/forms/query-filter-select';
import { QueryFilterSwitch } from '@/components/forms/query-filter-switch';
import { QuerySearchInput } from '@/components/forms/query-search-input';
import { Badge } from '@/components/ui/badge';
import { queryHref } from '@/lib/query-href';
import { knowledgePreservedParams, type KnowledgePageQuery } from '../knowledge-page-query';

export function KnowledgeFilters({ query }: { query: KnowledgePageQuery }) {
  const t = useTranslations('knowledge');
  const pathname = usePathname();
  const preserved = useMemo(() => knowledgePreservedParams(query), [query]);
  const searchPreserved = useMemo(() => ({ ...preserved, search: undefined }), [preserved]);

  if (query.view === 'dates') {
    return (
      <QuerySearchInput
        className="md:max-w-80"
        label={t('searchDatesLabel')}
        placeholder={t('searchDatesPlaceholder')}
        preserveParams={searchPreserved}
        search={query.search}
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-3">
      <QuerySearchInput
        label={t('searchNotesLabel')}
        placeholder={t('searchNotesPlaceholder')}
        preserveParams={searchPreserved}
        search={query.search}
      />
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <QueryFilterSelect
          label={t('categoryFilter')}
          labelClassName="sr-only"
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
        <QueryFilterSwitch
          checked={query.pinned === 'true'}
          label={t('pinnedFilter')}
          name="pinned"
          preserveParams={{ ...preserved, pinned: undefined }}
        />
      </div>
      {query.tag ? (
        <Link
          aria-label={t('clearTag', { tag: query.tag })}
          className="w-fit hover:no-underline"
          href={queryHref(pathname, { ...preserved, tag: undefined }, 'tag', '') as Route}
        >
          <Badge intent="accent">
            #{query.tag}
            <span aria-hidden="true">×</span>
          </Badge>
        </Link>
      ) : null}
    </div>
  );
}
