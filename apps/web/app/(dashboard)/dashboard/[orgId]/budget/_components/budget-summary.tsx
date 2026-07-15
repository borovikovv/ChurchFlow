'use client';

import type { BudgetCurrencyTotals, BudgetTotals } from '@churchflow/shared';
import { formatMoney } from './budget-table-helpers';

export function YearSummary({ totals }: { totals: BudgetTotals }) {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <SummaryCard label="Year income" totals={totals.income} />
      <SummaryCard label="Year expenses" totals={totals.expense} />
      <SummaryCard label="Year balance" totals={totals.balance} />
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
    <span className={className ?? 'grid gap-1 text-sm'}>
      <span>{formatMoney(totals.amountUah, 'UAH')}</span>
      <span>{formatMoney(totals.amountUsd, 'USD')}</span>
      <span>{formatMoney(totals.amountEur, 'EUR')}</span>
    </span>
  );
}

function SummaryCard({ label, totals }: { label: string; totals: BudgetCurrencyTotals }) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <CurrencyTotals totals={totals} className="mt-2 text-lg font-semibold" />
    </article>
  );
}
