'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { BudgetCurrencyTotals, BudgetTotals, ExchangeRates } from '@churchflow/shared';
import { formatMoney, toUahEquivalent } from './budget-table-helpers';

export function YearSummary({
  closingBalance,
  openingAction,
  openingBalance,
  rates,
  totals,
}: {
  closingBalance: BudgetCurrencyTotals;
  openingAction?: ReactNode;
  openingBalance: BudgetCurrencyTotals;
  rates: ExchangeRates | null;
  totals: BudgetTotals;
}) {
  const t = useTranslations('budget');

  return (
    <section className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
      <SummaryCard
        action={openingAction}
        converted={toUahEquivalent(openingBalance, rates)}
        label={t('yearOpeningBalance')}
        totals={openingBalance}
      />
      <SummaryCard label={t('yearIncome')} totals={totals.income} />
      <SummaryCard label={t('yearExpenses')} totals={totals.expense} />
      <SummaryCard
        converted={toUahEquivalent(closingBalance, rates)}
        label={t('yearClosingBalance')}
        totals={closingBalance}
      />
    </section>
  );
}

export function CurrencyTotals({
  totals,
  className,
}: {
  totals: BudgetCurrencyTotals;
  className?: string;
}) {
  const locale = useLocale();

  return (
    <div
      className={className ?? 'flex flex-wrap items-baseline gap-x-3 gap-y-1 text-lg text-black'}
    >
      <p className="whitespace-nowrap text-black">{formatMoney(totals.amountUah, 'UAH', locale)}</p>
      <p className="whitespace-nowrap text-black">{formatMoney(totals.amountUsd, 'USD', locale)}</p>
      <p className="whitespace-nowrap text-black">{formatMoney(totals.amountEur, 'EUR', locale)}</p>
    </div>
  );
}

function SummaryCard({
  action,
  converted = null,
  label,
  totals,
}: {
  action?: ReactNode;
  converted?: number | null;
  label: string;
  totals: BudgetCurrencyTotals;
}) {
  const locale = useLocale();

  return (
    <article className="grid min-w-0 gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-[var(--muted)]">{label}</span>
        {action}
      </div>
      {converted === null ? (
        <CurrencyTotals totals={totals} />
      ) : (
        <>
          <p className="m-0 whitespace-nowrap text-lg text-black">
            ≈ {formatMoney(converted, 'UAH', locale)}
          </p>
          <CurrencyTotals
            className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-black"
            totals={totals}
          />
        </>
      )}
    </article>
  );
}
