'use client';

import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';

export function DeleteBudgetExchangeDialog({
  disabled = false,
  summary,
  onConfirm,
}: {
  disabled?: boolean;
  summary: string;
  onConfirm: () => void;
}) {
  const t = useTranslations('budget');
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <FormDialog
      dialogRef={dialogRef}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            {t('close')}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              dialogRef.current?.close();
              onConfirm();
            }}
          >
            {t('deleteExchange')}
          </Button>
        </div>
      }
      title={t('deleteExchangeTitle')}
      triggerClassName="h-7 px-2 text-xs"
      triggerDisabled={disabled}
      triggerLabel={t('deleteExchange')}
      triggerVariant="danger"
    >
      <div className="grid gap-3 text-sm text-[var(--muted)]">
        <p className="m-0">{t('deleteExchangeDescription', { exchange: summary })}</p>
        <p className="m-0">{t('actionCannotBeUndone')}</p>
      </div>
    </FormDialog>
  );
}
