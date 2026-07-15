'use client';

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
import { GROUP_LABELS, MONTH_NAMES, formatMoney } from './budget-table-helpers';

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
  months,
  groupSummaries,
  year,
}: {
  chartRef: RefObject<HTMLDivElement | null>;
  months: BudgetMonth[];
  groupSummaries: Array<{ group: BudgetGroup; totals: BudgetTotals }>;
  year: number;
}) {
  return (
    <section
      ref={chartRef}
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2>Budget charts {year}</h2>
        <span className="text-sm text-[var(--muted)]">UAH totals</span>
      </div>
      <div className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]">
        <MonthlyBudgetBars months={months} />
        <BudgetGroupLines groupSummaries={groupSummaries} />
      </div>
    </section>
  );
}

function MonthlyBudgetBars({ months }: { months: BudgetMonth[] }) {
  const data = monthlyChartData(months);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <h3 className="mb-3 text-base">Monthly income and expenses</h3>
      <div className="flex min-h-72 min-w-0 flex-1 items-end rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-2 pb-2 pt-4">
        <ResponsiveContainer height={240} width="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
              tickFormatter={(value) => formatChartAmount(Number(value))}
              tickLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ fill: 'rgba(31,35,40,0.06)' }}
              formatter={(value, name) => [
                formatMoney(Number(value), 'UAH'),
                name === 'income' ? 'Income' : 'Expenses',
              ]}
              labelFormatter={(label) => `${label}`}
            />
            <Bar dataKey="income" fill="#10b981" name="income" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="#f43f5e" name="expenses" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function monthlyChartData(months: BudgetMonth[]): MonthlyChartItem[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = months.find((item) => item.month === index + 1);
    return {
      balance: month?.totals.balance.amountUah ?? 0,
      expenses: month?.totals.expense.amountUah ?? 0,
      income: month?.totals.income.amountUah ?? 0,
      label: MONTH_NAMES[index]?.slice(0, 3) ?? String(index + 1),
      month: index + 1,
    };
  });
}

function formatChartAmount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    notation: 'compact',
  }).format(value);
}

function BudgetGroupLines({
  groupSummaries,
}: {
  groupSummaries: Array<{ group: BudgetGroup; totals: BudgetTotals }>;
}) {
  const data = groupChartData(groupSummaries);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <h3 className="mb-3 text-base">Year totals by group</h3>
      <div className="flex min-h-72 min-w-0 flex-1 items-end rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-2 pb-2 pt-4">
        <ResponsiveContainer height={240} width="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
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
              tickFormatter={(value) => formatChartAmount(Number(value))}
              tickLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }}
              formatter={(value, name) => [
                formatMoney(Number(value), 'UAH'),
                name === 'income' ? 'Income' : 'Expenses',
              ]}
              labelFormatter={(label) => `${label}`}
            />
            <Legend height={28} verticalAlign="top" />
            <Line
              activeDot={{ r: 5 }}
              dataKey="income"
              dot={{ r: 3 }}
              name="Income"
              stroke="#10b981"
              strokeWidth={2}
              type="monotone"
            />
            <Line
              activeDot={{ r: 5 }}
              dataKey="expenses"
              dot={{ r: 3 }}
              name="Expenses"
              stroke="#f43f5e"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function groupChartData(
  groupSummaries: Array<{ group: BudgetGroup; totals: BudgetTotals }>,
): GroupChartItem[] {
  return groupSummaries.map((summary) => ({
    expenses: summary.totals.expense.amountUah,
    group: summary.group,
    income: summary.totals.income.amountUah,
    label: GROUP_LABELS[summary.group],
  }));
}
