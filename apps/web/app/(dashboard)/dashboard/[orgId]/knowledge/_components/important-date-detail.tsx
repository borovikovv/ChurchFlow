'use client';

import { useTranslations } from 'next-intl';
import type { ImportantDateItem } from '@churchflow/shared';
import { ImportantDateDetailActions } from './important-date-actions';
import { KnowledgeVisibilityBadge } from './knowledge-badges';
import { knowledgeListClassNames } from './knowledge-lists.styles';
import type { ImportantDatesListProps } from './knowledge-lists.types';
import {
  ImportantDateNextDate,
  ImportantDateReminder,
  ImportantDateRuleLabel,
  KnowledgeDate,
} from './knowledge-meta';

export function ImportantDateDetail({
  date,
  payload,
  onDelete,
  onUpdate,
}: Omit<ImportantDatesListProps, 'filtered'> & { date: ImportantDateItem }) {
  const t = useTranslations('knowledge');
  const author = date.updatedBy ?? date.createdBy;

  return (
    <article className={`${knowledgeListClassNames.panel} grid gap-5 p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <KnowledgeVisibilityBadge size="md" visibility={date.visibility} />
        {payload.canManage ? (
          <ImportantDateDetailActions
            assignableVisibilities={payload.assignableVisibilities}
            date={date}
            onDelete={onDelete}
            onUpdate={onUpdate}
          />
        ) : null}
      </div>
      <header className="grid gap-2">
        <h2 className="m-0 text-3xl font-bold [overflow-wrap:anywhere]">{date.title}</h2>
        <p className="m-0 text-base text-[var(--muted)]">
          <ImportantDateRuleLabel date={date} />
        </p>
      </header>
      <dl className="m-0 grid grid-cols-2 gap-4 text-base">
        <div className="grid gap-1">
          <dt className={knowledgeListClassNames.detailLabel}>{t('nextDateColumn')}</dt>
          <dd className="m-0 font-medium">
            <ImportantDateNextDate nextDate={date.nextDate} />
          </dd>
        </div>
        <div className="grid gap-1">
          <dt className={knowledgeListClassNames.detailLabel}>{t('reminderColumn')}</dt>
          <dd className="m-0">
            <ImportantDateReminder days={date.reminderLeadDays} />
          </dd>
        </div>
      </dl>
      {date.notes ? (
        <p className="m-0 whitespace-pre-wrap text-base leading-relaxed [overflow-wrap:anywhere]">
          {date.notes}
        </p>
      ) : null}
      <footer className="border-t border-[var(--line-muted)] pt-4 text-sm text-[var(--muted)]">
        {t('updated')} <KnowledgeDate value={date.updatedAt} />
        {' · '}
        {author?.displayName ?? t('unknownAuthor')}
      </footer>
    </article>
  );
}
