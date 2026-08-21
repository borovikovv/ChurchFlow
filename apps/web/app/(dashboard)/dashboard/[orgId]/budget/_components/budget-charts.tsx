'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { RefObject } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  BudgetCurrencyTotals,
  BudgetGroup,
  BudgetMonth,
  BudgetTotals,
  ExchangeRates,
} from '@churchflow/shared';
import { formatMoney, toUahEquivalent, type BudgetGroupLabels } from './budget-table-helpers';

type MonthlyChartItem = {
  balance: number;
  expenses: number;
  income: number;
  label: string;
  month: number;
};

type GroupChartItem = {
  expenses: number;
  group: BudgetGroup;
  income: number;
  label: string;
  total: number;
};

export function BudgetCharts({
  chartRef,
  displayMonths,
  exportMode = false,
  groupLabels,
  months,
  groupSummaries,
  monthNames,
  periodLabel,
  rates,
  year,
}: {
  chartRef: RefObject<HTMLDivElement | null> | null;
  displayMonths?: number[] | undefined;
  exportMode?: boolean;
  groupLabels: BudgetGroupLabels;
  months: BudgetMonth[];
  groupSummaries: Array<{ group: BudgetGroup; totals: BudgetTotals }>;
  monthNames: string[];
  periodLabel?: string;
  rates: ExchangeRates | null;
  year: number;
}) {
  const t = useTranslations('budget');
  const locale = useLocale();

  return (
    <section
      ref={chartRef}
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2>{t('budgetCharts', { period: periodLabel ?? year })}</h2>
        <span className="text-right text-sm text-[var(--muted)]">
          {rates
            ? t('ratesAsOf', {
                date: rates.date,
                eur: formatMoney(rates.eurToUah, 'UAH', locale),
                usd: formatMoney(rates.usdToUah, 'UAH', locale),
              })
            : t('ratesUnavailable')}
        </span>
      </div>
      <div
        className={
          exportMode
            ? 'grid grid-cols-2 items-stretch gap-8'
            : 'grid items-stretch gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]'
        }
      >
        <MonthlyBudgetBars
          displayMonths={displayMonths}
          exportMode={exportMode}
          monthNames={monthNames}
          months={months}
          rates={rates}
        />
        <BudgetGroupBars
          exportMode={exportMode}
          groupLabels={groupLabels}
          groupSummaries={groupSummaries}
          rates={rates}
        />
      </div>
    </section>
  );
}

function MonthlyBudgetBars({
  displayMonths,
  exportMode,
  monthNames,
  months,
  rates,
}: {
  displayMonths?: number[] | undefined;
  exportMode: boolean;
  monthNames: string[];
  months: BudgetMonth[];
  rates: ExchangeRates | null;
}) {
  const t = useTranslations('budget');
  const locale = useLocale();
  const data = monthlyChartData(months, monthNames, rates, displayMonths);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <h3 className="mb-1 text-base">{t('monthlyIncomeExpenses')}</h3>
      <p className="mb-3 text-xs text-[var(--muted)]">
        {rates ? t('chartConvertedUah') : t('chartUahOnly')}
      </p>
      <div className="flex min-h-72 min-w-0 flex-1 items-end rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-2 pb-2 pt-4">
        {exportMode ? (
          <MonthlyBudgetBarChart data={data} locale={locale} width={520} />
        ) : (
          <ResponsiveContainer height={240} width="100%">
            <MonthlyBudgetBarChart data={data} locale={locale} />
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function MonthlyBudgetBarChart({
  data,
  locale,
  width,
}: {
  data: MonthlyChartItem[];
  locale: string;
  width?: number | undefined;
}) {
  const t = useTranslations('budget');

  return (
    <BarChart
      data={data}
      height={240}
      margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      {...(width ? { width } : {})}
    >
      <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
      <XAxis
        axisLine={false}
        dataKey="label"
        tick={{ fill: 'var(--muted)', fontSize: 12 }}
        tickLine={false}
      />
      <YAxis
        axisLine={false}
        tick={{ fill: 'var(--muted)', fontSize: 12 }}
        tickFormatter={(value) => formatChartAmount(Number(value), locale)}
        tickLine={false}
        width={64}
      />
      <Tooltip
        cursor={{ fill: 'rgba(31,35,40,0.06)' }}
        formatter={(value, name) => [
          formatMoney(Number(value), 'UAH', locale),
          name === 'income' ? t('income') : t('expenses'),
        ]}
        labelFormatter={(label) => `${label}`}
      />
      <Bar
        dataKey="income"
        fill="#10b981"
        isAnimationActive={false}
        name="income"
        radius={[4, 4, 0, 0]}
      />
      <Bar
        dataKey="expenses"
        fill="#f43f5e"
        isAnimationActive={false}
        name="expenses"
        radius={[4, 4, 0, 0]}
      />
    </BarChart>
  );
}

function monthlyChartData(
  months: BudgetMonth[],
  monthNames: string[],
  rates: ExchangeRates | null,
  displayMonths = Array.from({ length: 12 }, (_, index) => index + 1),
): MonthlyChartItem[] {
  return displayMonths.map((monthNumber) => {
    const month = months.find((item) => item.month === monthNumber);
    return {
      balance: monthAmount(month?.totals.balance, rates),
      expenses: monthAmount(month?.totals.expense, rates),
      income: monthAmount(month?.totals.income, rates),
      label: monthNames[monthNumber - 1]?.slice(0, 3) ?? String(monthNumber),
      month: monthNumber,
    };
  });
}

function monthAmount(
  totals: BudgetCurrencyTotals | undefined,
  rates: ExchangeRates | null,
): number {
  if (!totals) return 0;

  return toUahEquivalent(totals, rates) ?? totals.amountUah;
}

function formatChartAmount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    notation: 'compact',
  }).format(value);
}

function BudgetGroupBars({
  exportMode,
  groupLabels,
  groupSummaries,
  rates,
}: {
  exportMode: boolean;
  groupLabels: BudgetGroupLabels;
  groupSummaries: Array<{ group: BudgetGroup; totals: BudgetTotals }>;
  rates: ExchangeRates | null;
}) {
  const t = useTranslations('budget');
  const data = groupChartData(groupSummaries, groupLabels, rates);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <h3 className="mb-1 text-base">{t('yearTotalsByGroup')}</h3>
      <p className="mb-3 text-xs text-[var(--muted)]">
        {rates ? t('chartConvertedUah') : t('chartUahOnly')}
      </p>
      <div className="flex min-h-72 min-w-0 flex-1 items-end rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-2 pb-2 pt-4">
        {exportMode ? (
          <BudgetGroupBarChart data={data} width={520} />
        ) : (
          <ResponsiveContainer height={240} width="100%">
            <BudgetGroupBarChart data={data} />
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function BudgetGroupBarChart({
  data,
  width,
}: {
  data: GroupChartItem[];
  width?: number | undefined;
}) {
  const t = useTranslations('budget');
  const locale = useLocale();

  return (
    <BarChart
      barCategoryGap="20%"
      barGap={2}
      data={data}
      height={240}
      layout="vertical"
      margin={{ top: 8, right: 56, bottom: 0, left: 0 }}
      {...(width ? { width } : {})}
    >
      <CartesianGrid horizontal={false} stroke="var(--line)" strokeDasharray="3 3" />
      <XAxis
        axisLine={false}
        tick={{ fill: 'var(--muted)', fontSize: 12 }}
        tickFormatter={(value) => formatChartAmount(Number(value), locale)}
        tickLine={false}
        type="number"
      />
      <YAxis
        axisLine={false}
        dataKey="label"
        tick={{ fill: 'var(--muted)', fontSize: 11 }}
        tickLine={false}
        type="category"
        width={112}
      />
      <Tooltip
        cursor={{ fill: 'rgba(31,35,40,0.06)' }}
        formatter={(value, name) => [
          formatMoney(Number(value), 'UAH', locale),
          name === 'income' ? t('income') : t('expenses'),
        ]}
        labelFormatter={(label) => `${label}`}
      />
      <Legend
        formatter={(value) => (value === 'income' ? t('income') : t('expenses'))}
        height={28}
        verticalAlign="top"
      />
      <Bar
        dataKey="income"
        fill="#10b981"
        isAnimationActive={false}
        name="income"
        radius={[0, 4, 4, 0]}
      >
        <LabelList
          dataKey="income"
          fill="var(--muted)"
          fontSize={11}
          formatter={(value) => formatChartLabel(value, locale)}
          position="right"
        />
      </Bar>
      <Bar
        dataKey="expenses"
        fill="#f43f5e"
        isAnimationActive={false}
        name="expenses"
        radius={[0, 4, 4, 0]}
      >
        <LabelList
          dataKey="expenses"
          fill="var(--muted)"
          fontSize={11}
          formatter={(value) => formatChartLabel(value, locale)}
          position="right"
        />
      </Bar>
    </BarChart>
  );
}

function groupChartData(
  groupSummaries: Array<{ group: BudgetGroup; totals: BudgetTotals }>,
  groupLabels: BudgetGroupLabels,
  rates: ExchangeRates | null,
): GroupChartItem[] {
  return groupSummaries
    .map((summary) => {
      const expenses =
        toUahEquivalent(summary.totals.expense, rates) ?? summary.totals.expense.amountUah;
      const income =
        toUahEquivalent(summary.totals.income, rates) ?? summary.totals.income.amountUah;
      return {
        expenses,
        group: summary.group,
        income,
        label: groupLabels[summary.group],
        total: income + expenses,
      };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
}

function formatChartLabel(value: unknown, locale: string): string {
  const amount = Number(value);

  return amount > 0 ? formatChartAmount(amount, locale) : '';
}
