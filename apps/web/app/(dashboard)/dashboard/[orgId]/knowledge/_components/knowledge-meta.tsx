'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { ImportantDateItem, KnowledgeAuthor } from '@churchflow/shared';
import { formatCalendarDay, importantDateRuleParts } from '../important-date-format';

export function KnowledgeAuthorMeta({
  createdAt,
  createdBy,
  updatedAt,
  updatedBy,
}: {
  createdAt: string;
  createdBy: KnowledgeAuthor | null;
  updatedAt: string;
  updatedBy: KnowledgeAuthor | null;
}) {
  const t = useTranslations('knowledge');
  const locale = useLocale();
  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }),
    [locale],
  );
  const date = (value: string) => formatter.format(new Date(value));
  const unknown = t('unknownAuthor');

  return (
    <span className="grid gap-0.5 text-xs text-[var(--muted)]">
      <span>
        {t('createdMeta', { name: createdBy?.displayName ?? unknown, date: date(createdAt) })}
      </span>
      {updatedAt !== createdAt ? (
        <span>
          {t('updatedMeta', { name: updatedBy?.displayName ?? unknown, date: date(updatedAt) })}
        </span>
      ) : null}
    </span>
  );
}

export function ImportantDateRuleLabel({
  date,
}: {
  date: Pick<ImportantDateItem, 'ruleKind' | 'month' | 'day' | 'weekday' | 'nth'>;
}) {
  const t = useTranslations('knowledge');
  const locale = useLocale();
  const parts = useMemo(() => importantDateRuleParts(locale, date), [date, locale]);

  if (!parts) return <>{t('noDate')}</>;
  if (parts.kind === 'fixed') return <>{t('ruleFixed', { date: parts.dayAndMonth })}</>;

  return (
    <>
      {t('ruleNthWeekday', {
        ordinal: t(`ordinals.${parts.ordinal}`, { weekday: parts.weekday }),
        weekday: t(`weekdays.${parts.weekday}`),
        month: parts.month,
      })}
    </>
  );
}

export function ImportantDateNextDate({ nextDate }: { nextDate: string | null }) {
  const t = useTranslations('knowledge');
  const locale = useLocale();

  return <>{nextDate ? formatCalendarDay(locale, nextDate) : t('noDate')}</>;
}

export function ImportantDateReminder({ days }: { days: number | null }) {
  const t = useTranslations('knowledge');

  return <>{days === null ? t('noReminder') : t('reminderDays', { count: days })}</>;
}
