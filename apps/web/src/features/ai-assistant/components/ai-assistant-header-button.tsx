'use client';

import { useTranslations } from 'next-intl';
import { AssistantIcon } from '@/components/icons/navigation-icons';

export function AiAssistantHeaderButton({ onOpen }: { onOpen: () => void }) {
  const t = useTranslations('aiAssistant');

  return (
    <button
      aria-haspopup="dialog"
      aria-label={t('open')}
      className="hidden h-10 cursor-pointer items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] md:inline-flex"
      type="button"
      onClick={onOpen}
    >
      <AssistantIcon className="h-5 w-5 text-[var(--accent)]" />
      {t('title')}
    </button>
  );
}
