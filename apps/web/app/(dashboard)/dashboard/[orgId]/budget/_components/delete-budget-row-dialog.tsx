'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef } from 'react';
import { Button } from '@/components/ui/button';

export function DeleteBudgetRowDialog({
  disabled = false,
  monthName,
  rowNumber,
  onConfirm,
}: {
  disabled?: boolean;
  monthName: string;
  rowNumber: number;
  onConfirm: () => void;
}) {
  const t = useTranslations('budget');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <Button
        aria-label={t('removeLastRow')}
        className="h-8 w-8 px-0"
        disabled={disabled}
        type="button"
        variant="secondary"
        onClick={() => dialogRef.current?.showModal()}
      >
        -
      </Button>
      <dialog
        aria-labelledby={titleId}
        className="fixed inset-0 m-auto max-h-[min(800px,80dvh)] w-[min(480px,calc(100%-32px))] max-w-none rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[0_16px_48px_rgba(31,35,40,0.2)] backdrop:bg-[rgba(31,35,40,0.45)] backdrop:backdrop-blur-[1px]"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        ref={dialogRef}
      >
        <form
          method="dialog"
          onSubmit={(event) => {
            event.preventDefault();
            dialogRef.current?.close();
            onConfirm();
          }}
        >
          <header className="flex items-center justify-between border-b border-[var(--line)] p-5">
            <h2 id={titleId}>{t('removeRowTitle', { row: rowNumber })}</h2>
            <button
              aria-label={t('close')}
              className="h-8 w-8 cursor-pointer rounded-[var(--radius)] border-0 bg-transparent text-2xl text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </header>
          <div className="grid gap-3 p-5 text-sm text-[var(--muted)]">
            <p>{t('removeRowDescription', { month: monthName })}</p>
            <p>{t('actionCannotBeUndone')}</p>
          </div>
          <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--line)] p-5">
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
              {t('close')}
            </Button>
            <Button type="submit" variant="danger">
              {t('removeRow')}
            </Button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
