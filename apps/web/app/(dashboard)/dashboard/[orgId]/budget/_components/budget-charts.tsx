'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { RefObject } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BudgetGroup, BudgetMonth, BudgetTotals } from '@churchflow/shared';
import { formatMoney, type BudgetGroupLabels } from './budget-table-helpers';

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
  year: number;
}) {
  const t = useTranslations('budget');

  return (
    <section
      ref={chartRef}
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2>{t('budgetCharts', { period: periodLabel ?? year })}</h2>
        <span className="text-sm text-[var(--muted)]">{t('uahTotals')}</span>
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
        />
        <BudgetGroupLines
          exportMode={exportMode}
          groupLabels={groupLabels}
          groupSummaries={groupSummaries}
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
}: {
  displayMonths?: number[] | undefined;
  exportMode: boolean;
  monthNames: string[];
  months: BudgetMonth[];
}) {
  const t = useTranslations('budget');
  const locale = useLocale();
  const data = monthlyChartData(months, monthNames, displayMonths);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <h3 className="mb-3 text-base">{t('monthlyIncomeExpenses')}</h3>
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
        width={44}
      />
      <Tooltip
        cursor={{ fill: 'rgba(31,35,40,0.06)' }}
        formatter={(value, name) => [
          formatMoney(Number(value), 'UAH'),
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
  displayMonths = Array.from({ length: 12 }, (_, index) => index + 1),
): MonthlyChartItem[] {
  return displayMonths.map((monthNumber) => {
    const month = months.find((item) => item.month === monthNumber);
    return {
      balance: month?.totals.balance.amountUah ?? 0,
      expenses: month?.totals.expense.amountUah ?? 0,
      income: month?.totals.income.amountUah ?? 0,
      label: monthNames[monthNumber - 1]?.slice(0, 3) ?? String(monthNumber),
      month: monthNumber,
    };
  });
}

function formatChartAmount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    notation: 'compact',
  }).format(value);
}

function BudgetGroupLines({
  exportMode,
  groupLabels,
  groupSummaries,
}: {
  exportMode: boolean;
  groupLabels: BudgetGroupLabels;
  groupSummaries: Array<{ group: BudgetGroup; totals: BudgetTotals }>;
}) {
  const t = useTranslations('budget');
  const data = groupChartData(groupSummaries, groupLabels);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <h3 className="mb-3 text-base">{t('yearTotalsByGroup')}</h3>
      <div className="flex min-h-72 min-w-0 flex-1 items-end rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-2 pb-2 pt-4">
        {exportMode ? (
          <BudgetGroupLineChart data={data} width={520} />
        ) : (
          <ResponsiveContainer height={240} width="100%">
            <BudgetGroupLineChart data={data} />
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function BudgetGroupLineChart({
  data,
  width,
}: {
  data: GroupChartItem[];
  width?: number | undefined;
}) {
  const t = useTranslations('budget');
  const locale = useLocale();

  return (
    <LineChart
      data={data}
      height={240}
      margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
      {...(width ? { width } : {})}
    >
      <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
      <XAxis
        axisLine={false}
        dataKey="label"
        interval={0}
        tick={{ fill: 'var(--muted)', fontSize: 11 }}
        tickLine={false}
      />
      <YAxis
        axisLine={false}
        tick={{ fill: 'var(--muted)', fontSize: 12 }}
        tickFormatter={(value) => formatChartAmount(Number(value), locale)}
        tickLine={false}
        width={44}
      />
      <Tooltip
        cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }}
        formatter={(value, name) => [
          formatMoney(Number(value), 'UAH'),
          name === 'income' ? t('income') : t('expenses'),
        ]}
        labelFormatter={(label) => `${label}`}
      />
      <Legend height={28} verticalAlign="top" />
      <Line
        activeDot={{ r: 5 }}
        dataKey="income"
        dot={{ r: 3 }}
        isAnimationActive={false}
        name={t('income')}
        stroke="#10b981"
        strokeWidth={2}
        type="monotone"
      />
      <Line
        activeDot={{ r: 5 }}
        dataKey="expenses"
        dot={{ r: 3 }}
        isAnimationActive={false}
        name={t('expenses')}
        stroke="#f43f5e"
        strokeWidth={2}
        type="monotone"
      />
    </LineChart>
  );
}

function groupChartData(
  groupSummaries: Array<{ group: BudgetGroup; totals: BudgetTotals }>,
  groupLabels: BudgetGroupLabels,
): GroupChartItem[] {
  return groupSummaries.map((summary) => ({
    expenses: summary.totals.expense.amountUah,
    group: summary.group,
    income: summary.totals.income.amountUah,
    label: groupLabels[summary.group],
  }));
}
