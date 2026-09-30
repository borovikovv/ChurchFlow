'use client';

import { useTranslations } from 'next-intl';
import { AssistantIcon } from '@/components/icons/navigation-icons';

const EXAMPLE_PROMPT_KEYS = ['summary', 'upcomingServices', 'findMember', 'prayerRequest'] as const;

export function AiAssistantEmptyState({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (prompt: string) => void;
}) {
  const t = useTranslations('aiAssistant');

  return (
    <div className="grid content-center justify-items-center gap-4 overflow-y-auto p-6 text-center">
      <AssistantIcon className="h-10 w-10 text-[var(--accent)]" />
      <div className="grid gap-1">
        <h3 className="m-0 text-lg">{t('emptyTitle')}</h3>
        <p className="m-0 text-sm text-[var(--muted)]">{t('emptyDescription')}</p>
      </div>
      <ul className="m-0 grid w-full list-none gap-2 p-0">
        {EXAMPLE_PROMPT_KEYS.map((key) => {
          const prompt = t(`examples.${key}`);

          return (
            <li key={key}>
              <button
                className="w-full cursor-pointer rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-55"
                disabled={disabled}
                type="button"
                onClick={() => onPick(prompt)}
              >
                {prompt}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
