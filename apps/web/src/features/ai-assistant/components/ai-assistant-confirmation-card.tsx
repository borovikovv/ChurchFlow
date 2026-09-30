'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export function AiAssistantConfirmationCard({
  reason,
  onRespond,
}: {
  reason: string;
  onRespond: (approved: boolean) => void;
}) {
  const t = useTranslations('aiAssistant');

  return (
    <section
      aria-label={t('confirmTitle')}
      className="grid gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-subtle)] p-3"
    >
      <div className="grid gap-1">
        <strong className="text-xs tracking-wide text-[var(--muted)] uppercase">
          {t('confirmTitle')}
        </strong>
        <p className="m-0 text-sm whitespace-pre-wrap">{reason}</p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => onRespond(false)}>
          {t('cancel')}
        </Button>
        <Button type="button" onClick={() => onRespond(true)}>
          {t('confirm')}
        </Button>
      </div>
    </section>
  );
}
