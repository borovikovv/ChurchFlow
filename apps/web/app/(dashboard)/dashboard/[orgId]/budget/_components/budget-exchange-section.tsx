'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import {
  exchangeRateGain,
  type BudgetExchange,
  type BudgetExchangeInput,
  type BudgetMonth,
} from '@churchflow/shared';
import { BudgetExchangeDialog } from './budget-exchange-dialog';
import { formatAmount, formatMoney } from './budget-table-helpers';
import { DeleteBudgetExchangeDialog } from './delete-budget-exchange-dialog';

export function BudgetExchangeSection({
  disabled,
  month,
  onCreate,
  onDelete,
  onUpdate,
}: {
  disabled: boolean;
  month: BudgetMonth;
  onCreate: (monthId: string, input: BudgetExchangeInput) => void;
  onDelete: (exchangeId: string) => void;
  onUpdate: (exchangeId: string, input: BudgetExchangeInput) => void;
}) {
  const t = useTranslations('budget');
  const locale = useLocale();

  return (
    <section className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h3 className="m-0 text-base">{t('exchanges')}</h3>
          <p className="m-0 text-xs text-[var(--muted)]">{t('exchangesDescription')}</p>
        </div>
        <BudgetExchangeDialog
          disabled={disabled}
          month={month}
          triggerLabel={t('addExchange')}
          onSave={(input) => onCreate(month.id, input)}
        />
      </div>
      {month.exchanges.length === 0 ? (
        <p className="m-0 text-sm text-[var(--muted)]">{t('noExchanges')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr>
                <ExchangeHeaderCell>{t('exchangeDate')}</ExchangeHeaderCell>
                <ExchangeHeaderCell>{t('exchangeFrom')}</ExchangeHeaderCell>
                <ExchangeHeaderCell>{t('exchangeTo')}</ExchangeHeaderCell>
                <ExchangeHeaderCell>{t('exchangeRate')}</ExchangeHeaderCell>
                <ExchangeHeaderCell>{t('exchangeGain')}</ExchangeHeaderCell>
                <ExchangeHeaderCell>{t('exchangeNote')}</ExchangeHeaderCell>
                <ExchangeHeaderCell> </ExchangeHeaderCell>
              </tr>
            </thead>
            <tbody>
              {month.exchanges.map((exchange) => (
                <tr key={exchange.id}>
                  <ExchangeCell>{exchange.occurredOn}</ExchangeCell>
                  <ExchangeCell className="tabular-nums">
                    {formatMoney(exchange.fromAmount, exchange.fromCurrency, locale)}
                  </ExchangeCell>
                  <ExchangeCell className="tabular-nums">
                    {formatMoney(exchange.toAmount, exchange.toCurrency, locale)}
                  </ExchangeCell>
                  <ExchangeCell className="tabular-nums">
                    {formatAmount(Number(exchange.dealRate.toFixed(6)), locale)}
                  </ExchangeCell>
                  <ExchangeCell className="tabular-nums">
                    <RateGain exchange={exchange} />
                  </ExchangeCell>
                  <ExchangeCell>{exchange.note ?? ''}</ExchangeCell>
                  <ExchangeCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      <BudgetExchangeDialog
                        disabled={disabled}
                        exchange={exchange}
                        month={month}
                        triggerClassName="h-7 px-2 text-xs"
                        triggerLabel={t('editExchange')}
                        onSave={(input) => onUpdate(exchange.id, input)}
                      />
                      <DeleteBudgetExchangeDialog
                        disabled={disabled}
                        summary={exchangeSummary(exchange, locale)}
                        onConfirm={() => onDelete(exchange.id)}
                      />
                    </div>
                  </ExchangeCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RateGain({ exchange }: { exchange: BudgetExchange }) {
  const locale = useLocale();
  const gain = exchangeRateGain(exchange);

  if (gain === null) return <span className="text-[var(--muted)]">—</span>;

  return (
    <span className={gain < 0 ? 'text-[#b42318]' : 'text-[#067647]'}>
      {gain > 0 ? '+' : ''}
      {formatMoney(gain, exchange.toCurrency, locale)}
    </span>
  );
}

function ExchangeHeaderCell({ children }: { children: ReactNode }) {
  return (
    <th className="border-b border-[var(--line)] px-2 py-2 text-left font-semibold text-[var(--muted)]">
      {children}
    </th>
  );
}

function ExchangeCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`border-b border-[var(--line)] px-2 py-2 ${className}`}>{children}</td>;
}

function exchangeSummary(exchange: BudgetExchange, locale: string): string {
  return `${formatMoney(exchange.fromAmount, exchange.fromCurrency, locale)} → ${formatMoney(
    exchange.toAmount,
    exchange.toCurrency,
    locale,
  )}`;
}
