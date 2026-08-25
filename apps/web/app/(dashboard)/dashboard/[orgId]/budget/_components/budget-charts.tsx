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
import type { BudgetCurrency, BudgetGroup, BudgetMonth, ExchangeRates } from '@churchflow/shared';
import { BudgetSummaryCards } from './budget-summary';
import type { BudgetSummaryData } from './budget-summary-types';
import {
  formatMoney,
  monthAmountInBase,
  type BudgetGroupBaseSummary,
  type BudgetGroupLabels,
} from './budget-table-helpers';

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
  baseCurrency,
  chartRef,
  displayMonths,
  exportMode = false,
  groupLabels,
  months,
  groupSummaries,
  monthNames,
  periodLabel,
  rates,
  summary,
  year,
}: {
  baseCurrency: BudgetCurrency;
  chartRef: RefObject<HTMLDivElement | null> | null;
  displayMonths?: number[] | undefined;
  exportMode?: boolean;
  groupLabels: BudgetGroupLabels;
  months: BudgetMonth[];
  groupSummaries: BudgetGroupBaseSummary[];
  monthNames: string[];
  periodLabel?: string;
  rates: ExchangeRates | null;
  summary?: BudgetSummaryData;
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
      {summary ? (
        <div className="mb-4">
          <BudgetSummaryCards {...summary} />
        </div>
      ) : null}
      <div
        className={
          exportMode
            ? 'grid grid-cols-2 items-stretch gap-8'
            : 'grid items-stretch gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]'
        }
      >
        <MonthlyBudgetBars
          baseCurrency={baseCurrency}
          displayMonths={displayMonths}
          exportMode={exportMode}
          monthNames={monthNames}
          months={months}
          rates={rates}
        />
        <BudgetGroupBars
          baseCurrency={baseCurrency}
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
  baseCurrency,
  displayMonths,
  exportMode,
  monthNames,
  months,
  rates,
}: {
  baseCurrency: BudgetCurrency;
  displayMonths?: number[] | undefined;
  exportMode: boolean;
  monthNames: string[];
  months: BudgetMonth[];
  rates: ExchangeRates | null;
}) {
  const t = useTranslations('budget');
  const locale = useLocale();
  const data = monthlyChartData(months, monthNames, baseCurrency, displayMonths);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <h3 className="mb-1 text-base">{t('monthlyIncomeExpenses')}</h3>
      <p className="mb-3 text-xs text-[var(--muted)]">
        {rates
          ? t('chartAmountsConverted', { currency: baseCurrency })
          : t('chartAmountsIn', { currency: baseCurrency })}
      </p>
      <div className="flex min-h-72 min-w-0 flex-1 items-end rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-2 pb-2 pt-4">
        {exportMode ? (
          <MonthlyBudgetBarChart
            baseCurrency={baseCurrency}
            data={data}
            locale={locale}
            width={520}
          />
        ) : (
          <ResponsiveContainer height={240} width="100%">
            <MonthlyBudgetBarChart baseCurrency={baseCurrency} data={data} locale={locale} />
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function MonthlyBudgetBarChart({
  baseCurrency,
  data,
  locale,
  width,
}: {
  baseCurrency: BudgetCurrency;
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
          formatMoney(Number(value), baseCurrency, locale),
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
  baseCurrency: BudgetCurrency,
  displayMonths = Array.from({ length: 12 }, (_, index) => index + 1),
): MonthlyChartItem[] {
  return displayMonths.map((monthNumber) => {
    const month = months.find((item) => item.month === monthNumber);
    return {
      balance: month ? monthAmountInBase(month.totals.balance, baseCurrency, month) : 0,
      expenses: month ? monthAmountInBase(month.totals.expense, baseCurrency, month) : 0,
      income: month ? monthAmountInBase(month.totals.income, baseCurrency, month) : 0,
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

function BudgetGroupBars({
  baseCurrency,
  exportMode,
  groupLabels,
  groupSummaries,
  rates,
}: {
  baseCurrency: BudgetCurrency;
  exportMode: boolean;
  groupLabels: BudgetGroupLabels;
  groupSummaries: BudgetGroupBaseSummary[];
  rates: ExchangeRates | null;
}) {
  const t = useTranslations('budget');
  const data = groupChartData(groupSummaries, groupLabels);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <h3 className="mb-1 text-base">{t('yearTotalsByGroup')}</h3>
      <p className="mb-3 text-xs text-[var(--muted)]">
        {rates
          ? t('chartAmountsConverted', { currency: baseCurrency })
          : t('chartAmountsIn', { currency: baseCurrency })}
      </p>
      <div className="flex min-h-72 min-w-0 flex-1 items-end rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-2 pb-2 pt-4">
        {exportMode ? (
          <BudgetGroupBarChart baseCurrency={baseCurrency} data={data} width={520} />
        ) : (
          <ResponsiveContainer height={240} width="100%">
            <BudgetGroupBarChart baseCurrency={baseCurrency} data={data} />
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function BudgetGroupBarChart({
  baseCurrency,
  data,
  width,
}: {
  baseCurrency: BudgetCurrency;
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
          formatMoney(Number(value), baseCurrency, locale),
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
  groupSummaries: BudgetGroupBaseSummary[],
  groupLabels: BudgetGroupLabels,
): GroupChartItem[] {
  return groupSummaries
    .map((summary) => ({
      expenses: summary.expense,
      group: summary.group,
      income: summary.income,
      label: groupLabels[summary.group],
      total: summary.income + summary.expense,
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
}

function formatChartLabel(value: unknown, locale: string): string {
  const amount = Number(value);

  return amount > 0 ? formatChartAmount(amount, locale) : '';
}
