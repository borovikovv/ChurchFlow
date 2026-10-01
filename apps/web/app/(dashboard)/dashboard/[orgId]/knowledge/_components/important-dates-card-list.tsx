'use client';

import { useTranslations } from 'next-intl';
import type { ImportantDateItem } from '@churchflow/shared';
import { CardList } from '@/components/ui/card-list';
import { ImportantDateActions } from './important-date-actions';
import {
  ImportantDateNextDate,
  ImportantDateReminder,
  ImportantDateRuleLabel,
} from './knowledge-meta';
import type { ImportantDatesListProps } from './knowledge-lists.types';

const getDateKey = (date: ImportantDateItem) => date.id;

export function ImportantDatesCardList({
  filtered,
  payload,
  onDelete,
  onUpdate,
}: ImportantDatesListProps) {
  const t = useTranslations('knowledge');

  return (
    <CardList
      data={payload.items}
      emptyMessage={filtered ? t('emptyDatesFiltered') : t('emptyDates')}
      getCardKey={getDateKey}
      renderCard={(date) => (
        <>
          <div className="flex min-w-0 items-start justify-between gap-2">
            <span className="grid min-w-0 gap-1">
              <span className="font-bold [overflow-wrap:anywhere]">{date.title}</span>
              <span className="text-sm text-[var(--muted)]">
                <ImportantDateRuleLabel date={date} />
              </span>
            </span>
            {payload.canManage ? (
              <ImportantDateActions
                assignableVisibilities={payload.assignableVisibilities}
                date={date}
                onDelete={onDelete}
                onUpdate={onUpdate}
              />
            ) : null}
          </div>
          {date.notes ? (
            <p className="m-0 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{date.notes}</p>
          ) : null}
          <dl className="m-0 grid grid-cols-2 gap-2 text-sm">
            <div className="grid gap-0.5">
              <dt className="text-xs text-[var(--muted)]">{t('nextDateColumn')}</dt>
              <dd className="m-0 font-medium">
                <ImportantDateNextDate nextDate={date.nextDate} />
              </dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-xs text-[var(--muted)]">{t('reminderColumn')}</dt>
              <dd className="m-0">
                <ImportantDateReminder days={date.reminderLeadDays} />
              </dd>
            </div>
            <div className="col-span-2 grid gap-0.5">
              <dt className="text-xs text-[var(--muted)]">{t('visibilityColumn')}</dt>
              <dd className="m-0">{t(`visibilities.${date.visibility}`)}</dd>
            </div>
          </dl>
        </>
      )}
    />
  );
}
