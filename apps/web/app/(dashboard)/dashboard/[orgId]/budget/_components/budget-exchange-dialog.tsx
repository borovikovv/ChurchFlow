'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import {
  BUDGET_CURRENCIES,
  rateToBase,
  type BudgetCurrency,
  type BudgetExchange,
  type BudgetExchangeInput,
  type BudgetMonth,
} from '@churchflow/shared';
import { FormInput } from '@/components/forms/form-input';
import { FormSelect } from '@/components/forms/form-select';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { BUDGET_CURRENCY_MESSAGE_KEY, formatAmount } from './budget-table-helpers';

type ExchangeDraft = {
  occurredOn: string;
  fromCurrency: BudgetCurrency;
  fromAmount: string;
  toCurrency: BudgetCurrency;
  toAmount: string;
  note: string;
};

export function BudgetExchangeDialog({
  disabled = false,
  exchange = null,
  month,
  triggerClassName,
  triggerLabel,
  onSave,
}: {
  disabled?: boolean;
  exchange?: BudgetExchange | null;
  month: BudgetMonth;
  triggerClassName?: string;
  triggerLabel: string;
  onSave: (input: BudgetExchangeInput) => void;
}) {
  const t = useTranslations('budget');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = useId();
  const [draft, setDraft] = useState<ExchangeDraft>(() => toDraft(exchange, month));

  const fromAmount = toAmount(draft.fromAmount);
  const toAmountValue = toAmount(draft.toAmount);
  const sameCurrency = draft.fromCurrency === draft.toCurrency;
  const dealRate = fromAmount > 0 && toAmountValue > 0 ? toAmountValue / fromAmount : null;
  const publishedRate = sameCurrency
    ? null
    : rateToBase(draft.fromCurrency, draft.toCurrency, month.rates);

  return (
    <FormDialog
      dialogRef={dialogRef}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            {t('close')}
          </Button>
          <Button
            disabled={sameCurrency || fromAmount <= 0 || toAmountValue <= 0}
            form={formId}
            type="submit"
          >
            {t('save')}
          </Button>
        </div>
      }
      title={exchange ? t('editExchangeTitle') : t('addExchangeTitle')}
      {...(triggerClassName ? { triggerClassName } : {})}
      triggerDisabled={disabled}
      triggerLabel={triggerLabel}
      triggerVariant="secondary"
      onOpen={() => setDraft(toDraft(exchange, month))}
    >
      <form
        className="grid gap-4"
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          if (sameCurrency || fromAmount <= 0 || toAmountValue <= 0) return;

          dialogRef.current?.close();
          onSave({
            occurredOn: draft.occurredOn,
            fromCurrency: draft.fromCurrency,
            fromAmount,
            toCurrency: draft.toCurrency,
            toAmount: toAmountValue,
            note: draft.note.trim() || null,
          });
        }}
      >
        <p className="m-0 text-sm text-[var(--muted)]">{t('exchangeDescription')}</p>
        <FormInput
          label={t('exchangeDate')}
          max={lastDayOfMonth(month)}
          min={firstDayOfMonth(month)}
          type="date"
          value={draft.occurredOn}
          onChange={(event) => setDraft({ ...draft, occurredOn: event.currentTarget.value })}
        />
        <AmountAndCurrency
          amount={draft.fromAmount}
          currency={draft.fromCurrency}
          label={t('exchangeFrom')}
          onAmountChange={(value) => setDraft({ ...draft, fromAmount: value })}
          onCurrencyChange={(value) => setDraft({ ...draft, fromCurrency: value })}
        />
        <AmountAndCurrency
          amount={draft.toAmount}
          currency={draft.toCurrency}
          label={t('exchangeTo')}
          onAmountChange={(value) => setDraft({ ...draft, toAmount: value })}
          onCurrencyChange={(value) => setDraft({ ...draft, toCurrency: value })}
        />
        {sameCurrency ? (
          <p className="form-error m-0">{t('exchangeSameCurrency')}</p>
        ) : (
          <ExchangeRateHint dealRate={dealRate} publishedRate={publishedRate} />
        )}
        <FormInput
          label={t('exchangeNote')}
          maxLength={500}
          type="text"
          value={draft.note}
          onChange={(event) => setDraft({ ...draft, note: event.currentTarget.value })}
        />
      </form>
    </FormDialog>
  );
}

function AmountAndCurrency({
  amount,
  currency,
  label,
  onAmountChange,
  onCurrencyChange,
}: {
  amount: string;
  currency: BudgetCurrency;
  label: string;
  onAmountChange: (value: string) => void;
  onCurrencyChange: (value: BudgetCurrency) => void;
}) {
  const t = useTranslations('budget');

  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,160px)]">
      <FormInput
        label={label}
        min={0}
        step={0.01}
        type="number"
        value={amount}
        onChange={(event) => onAmountChange(event.currentTarget.value)}
      />
      <FormSelect
        label={t('exchangeCurrency')}
        value={currency}
        onChange={(event) => onCurrencyChange(event.currentTarget.value as BudgetCurrency)}
      >
        {BUDGET_CURRENCIES.map((option) => (
          <option key={option} value={option}>
            {t(BUDGET_CURRENCY_MESSAGE_KEY[option])}
          </option>
        ))}
      </FormSelect>
    </div>
  );
}

// The rate is derived from the two amounts rather than entered: the cashier records what actually
// happened, and the published rate is only shown next to it for comparison.
function ExchangeRateHint({
  dealRate,
  publishedRate,
}: {
  dealRate: number | null;
  publishedRate: number | null;
}) {
  const t = useTranslations('budget');

  if (dealRate === null) return null;

  return (
    <p className="m-0 text-sm text-[var(--muted)]">
      {t('exchangeDealRate', { rate: formatRate(dealRate) })}
      {publishedRate === null
        ? null
        : ` · ${t('exchangePublishedRate', { rate: formatRate(publishedRate) })}`}
    </p>
  );
}

function formatRate(rate: number): string {
  return formatAmount(Number(rate.toFixed(6)), 'en');
}

function toDraft(exchange: BudgetExchange | null, month: BudgetMonth): ExchangeDraft {
  if (exchange) {
    return {
      occurredOn: exchange.occurredOn,
      fromCurrency: exchange.fromCurrency,
      fromAmount: String(exchange.fromAmount),
      toCurrency: exchange.toCurrency,
      toAmount: String(exchange.toAmount),
      note: exchange.note ?? '',
    };
  }

  return {
    occurredOn: defaultExchangeDate(month),
    fromCurrency: 'UAH',
    fromAmount: '',
    toCurrency: 'USD',
    toAmount: '',
    note: '',
  };
}

function defaultExchangeDate(month: BudgetMonth): string {
  const today = new Date().toISOString().slice(0, 10);
  const first = firstDayOfMonth(month);
  const last = lastDayOfMonth(month);

  if (today < first) return first;
  return today > last ? last : today;
}

function firstDayOfMonth(month: BudgetMonth): string {
  return `${String(month.year)}-${String(month.month).padStart(2, '0')}-01`;
}

function lastDayOfMonth(month: BudgetMonth): string {
  return new Date(Date.UTC(month.year, month.month, 0)).toISOString().slice(0, 10);
}

function toAmount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
