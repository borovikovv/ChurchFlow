'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { KnowledgeEntryItem } from '@churchflow/shared';
import { ChevronRightIcon } from '@/components/icons/action-icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RichTextContent } from '@/components/ui/rich-text-content';
import { queryHref } from '@/lib/query-href';
import { knowledgePreservedParams } from '../knowledge-page-query';
import { KnowledgeCategoryBadge, KnowledgeVisibilityBadge } from './knowledge-badges';
import { knowledgeListClassNames } from './knowledge-lists.styles';
import type { KnowledgeNotesBrowserProps } from './knowledge-lists.types';
import { KnowledgeDate } from './knowledge-meta';
import { KnowledgeNoteActions } from './knowledge-note-actions';

export function KnowledgeNoteDetail({
  disabled,
  entry,
  payload,
  query,
  onBack,
  onDelete,
  onUpdate,
}: Omit<KnowledgeNotesBrowserProps, 'filtered'> & {
  entry: KnowledgeEntryItem;
  onBack: () => void;
}) {
  const t = useTranslations('knowledge');
  const pathname = usePathname();
  const tagParams = { ...knowledgePreservedParams(query), tag: undefined };
  const author = entry.updatedBy ?? entry.createdBy;

  return (
    <article className={`${knowledgeListClassNames.panel} grid gap-5 p-4 md:p-6`}>
      <Button className="w-fit gap-1 md:hidden" type="button" variant="ghost" onClick={onBack}>
        <ChevronRightIcon className="h-4 w-4 rotate-180" />
        {t('backToList')}
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <KnowledgeCategoryBadge category={entry.category} size="md" />
          <KnowledgeVisibilityBadge size="md" visibility={entry.visibility} />
        </div>
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
      <header className="grid gap-3">
        <h2 className="m-0 text-2xl font-bold [overflow-wrap:anywhere] md:text-3xl">
          {entry.title}
        </h2>
        {entry.tags.length > 0 ? (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {entry.tags.map((tag) => (
              <li key={tag}>
                <Link
                  className="hover:no-underline"
                  href={queryHref(pathname, tagParams, 'tag', tag) as Route}
                >
                  <Badge intent="accent" size="md">
                    #{tag}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </header>
      <RichTextContent className="text-base leading-relaxed" html={entry.content} />
      <footer className="border-t border-[var(--line-muted)] pt-4 text-sm text-[var(--muted)]">
        {t('updated')} <KnowledgeDate value={entry.updatedAt} />
        {' · '}
        {author?.displayName ?? t('unknownAuthor')}
      </footer>
    </article>
  );
}
