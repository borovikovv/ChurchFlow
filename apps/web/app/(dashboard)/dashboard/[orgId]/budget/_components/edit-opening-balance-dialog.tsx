'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import type { BudgetCurrencyTotals } from '@churchflow/shared';
import { FormInput } from '@/components/forms/form-input';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';

type OpeningBalanceDraft = Record<keyof BudgetCurrencyTotals, string>;

export function EditOpeningBalanceDialog({
  carriedOver = false,
  disabled = false,
  seed,
  year,
  onSave,
}: {
  carriedOver?: boolean;
  disabled?: boolean;
  seed: BudgetCurrencyTotals;
  year: number;
  onSave: (totals: BudgetCurrencyTotals) => void;
}) {
  const t = useTranslations('budget');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = useId();
  const [draft, setDraft] = useState<OpeningBalanceDraft>(() => toDraft(seed));

  return (
    <FormDialog
      dialogRef={dialogRef}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            {t('close')}
          </Button>
          <Button form={formId} type="submit">
            {t('save')}
          </Button>
        </div>
      }
      title={t('openingBalanceTitle', { year })}
      triggerClassName="h-7 px-2 text-xs"
      triggerDisabled={disabled}
      triggerLabel={t('editOpeningBalance')}
      triggerVariant="secondary"
      onOpen={() => setDraft(toDraft(seed))}
    >
      <form
        className="grid gap-4"
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          dialogRef.current?.close();
          onSave({
            amountUah: toAmount(draft.amountUah),
            amountUsd: toAmount(draft.amountUsd),
            amountEur: toAmount(draft.amountEur),
          });
        }}
      >
        <p className="m-0 text-sm text-[var(--muted)]">
          {t('openingBalanceDescription', { year })}
        </p>
        {carriedOver ? (
          <p className="m-0 text-sm text-[var(--muted)]">{t('openingBalanceCarriedOver')}</p>
        ) : null}
        <FormInput
          label={t('currencyUah')}
          min={0}
          step={0.01}
          type="number"
          value={draft.amountUah}
          onChange={(event) => setDraft({ ...draft, amountUah: event.currentTarget.value })}
        />
        <FormInput
          label={t('currencyUsd')}
          min={0}
          step={0.01}
          type="number"
          value={draft.amountUsd}
          onChange={(event) => setDraft({ ...draft, amountUsd: event.currentTarget.value })}
        />
        <FormInput
          label={t('currencyEur')}
          min={0}
          step={0.01}
          type="number"
          value={draft.amountEur}
          onChange={(event) => setDraft({ ...draft, amountEur: event.currentTarget.value })}
        />
      </form>
    </FormDialog>
  );
}

function toDraft(totals: BudgetCurrencyTotals): OpeningBalanceDraft {
  return {
    amountUah: String(totals.amountUah),
    amountUsd: String(totals.amountUsd),
    amountEur: String(totals.amountEur),
  };
}

function toAmount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
