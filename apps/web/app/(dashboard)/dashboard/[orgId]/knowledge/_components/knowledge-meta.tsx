'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { ImportantDateItem } from '@churchflow/shared';
import { formatCalendarDay, importantDateRuleParts } from '../important-date-format';

export function KnowledgeDate({ value }: { value: string }) {
  const locale = useLocale();
  const label = useMemo(() => {
    const date = new Date(value);
    const thisYear = date.getFullYear() === new Date().getFullYear();

    return new Intl.DateTimeFormat(
      locale,
      thisYear ? { day: 'numeric', month: 'long' } : { dateStyle: 'medium' },
    ).format(date);
  }, [locale, value]);

  return <time dateTime={value}>{label}</time>;
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
