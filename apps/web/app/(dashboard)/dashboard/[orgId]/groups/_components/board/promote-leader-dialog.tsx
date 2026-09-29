'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import type { PendingPromotion } from './board.types';

/** Rendered only while a promotion waits for an answer; mounting it opens it as a modal. */
export function PromoteLeaderDialog({
  promotion,
  onConfirm,
  onCancel,
}: {
  promotion: PendingPromotion;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('groups');
  const titleId = useId();

  return (
    <dialog
      aria-labelledby={titleId}
      className="fixed inset-0 m-auto max-h-[min(800px,80dvh)] w-[min(480px,calc(100%-32px))] max-w-none rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[0_16px_48px_rgba(31,35,40,0.2)] backdrop:bg-[rgba(31,35,40,0.45)] backdrop:backdrop-blur-[1px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      onClose={onCancel}
      ref={(dialog) => {
        if (dialog && !dialog.open) dialog.showModal();
      }}
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <header className="flex items-center justify-between border-b border-[var(--line)] p-5">
          <h2 id={titleId}>{t('board.promoteTitle')}</h2>
          <button
            aria-label={t('cancel')}
            className="h-8 w-8 cursor-pointer rounded-[var(--radius)] border-0 bg-transparent text-2xl text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
            type="button"
            onClick={onCancel}
          >
            ×
          </button>
        </header>
        <div className="grid gap-3 p-5 text-sm text-[var(--muted)]">
          <p>
            {t('board.promoteDescription', {
              name: promotion.displayName,
              group: promotion.groupName,
            })}
          </p>
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--line)] p-5">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button type="submit">{t('board.promoteConfirm')}</Button>
        </footer>
      </form>
    </dialog>
  );
}
