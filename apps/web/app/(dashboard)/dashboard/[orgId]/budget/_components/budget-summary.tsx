'use client';

import { useTranslations } from 'next-intl';
import type { BudgetCurrencyTotals, BudgetTotals } from '@churchflow/shared';
import { formatMoney } from './budget-table-helpers';

export function YearSummary({ totals }: { totals: BudgetTotals }) {
  const t = useTranslations('budget');

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <SummaryCard label={t('yearIncome')} totals={totals.income} />
      <SummaryCard label={t('yearExpenses')} totals={totals.expense} />
      <SummaryCard label={t('yearBalance')} totals={totals.balance} />
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
  return (
    <div className={className ?? 'flex flex-nowrap items-center gap-3'}>
      <p className="whitespace-nowrap text-lg text-black">{formatMoney(totals.amountUah, 'UAH')}</p>
      <p className="whitespace-nowrap text-lg text-black">{formatMoney(totals.amountUsd, 'USD')}</p>
      <p className="whitespace-nowrap text-lg text-black">{formatMoney(totals.amountEur, 'EUR')}</p>
    </div>
  );
}

function SummaryCard({ label, totals }: { label: string; totals: BudgetCurrencyTotals }) {
  return (
    <article className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
      <span className="shrink-0 pr-1 text-sm text-[var(--muted)]">{label}</span>
      <CurrencyTotals totals={totals} />
    </article>
  );
}
