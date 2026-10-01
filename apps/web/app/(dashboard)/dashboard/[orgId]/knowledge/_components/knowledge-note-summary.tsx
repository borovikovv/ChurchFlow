'use client';

import { useTranslations } from 'next-intl';
import type { KnowledgeEntryItem } from '@churchflow/shared';
import { StatusBadge } from '@/components/ui/status-badge';

/** Title, pin, category and tags: what identifies a note in both the table and the cards. */
export function KnowledgeNoteSummary({ entry }: { entry: KnowledgeEntryItem }) {
  const t = useTranslations('knowledge');

  return (
    <span className="grid min-w-0 gap-1.5">
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="font-bold [overflow-wrap:anywhere]">{entry.title}</span>
        {entry.pinned ? <StatusBadge status="active" label={t('pinned')} /> : null}
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
        <span>{t(`categories.${entry.category}`)}</span>
        {entry.tags.map((tag) => (
          <span
            className="rounded-full border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-0.5"
            key={tag}
          >
            #{tag}
          </span>
        ))}
      </span>
    </span>
  );
}
