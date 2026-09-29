'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WebsiteAnalyticsTrendPoint } from '@churchflow/shared';
import { formatTrendDay } from '../analytics-report-view';

export function AnalyticsTrendChart({
  labels,
  locale,
  trend,
}: {
  labels: { users: string; pageViews: string };
  locale: string;
  trend: WebsiteAnalyticsTrendPoint[];
}) {
  const numberFormat = new Intl.NumberFormat(locale);

  return (
    <ResponsiveContainer height={240} width="100%">
      <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="date"
          minTickGap={24}
          tick={{ fill: 'var(--muted)', fontSize: 12 }}
          tickFormatter={(value) => formatTrendDay(String(value), locale)}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tick={{ fill: 'var(--muted)', fontSize: 12 }}
          tickFormatter={(value) => numberFormat.format(Number(value))}
          tickLine={false}
          width={48}
        />
        <Tooltip
          formatter={(value, name) => [
            numberFormat.format(Number(value)),
            name === 'pageViews' ? labels.pageViews : labels.users,
          ]}
          labelFormatter={(label) => formatTrendDay(String(label), locale)}
        />
        <Line
          dataKey="users"
          dot={false}
          isAnimationActive={false}
          name="users"
          stroke="var(--accent)"
          strokeWidth={2}
          type="monotone"
        />
        <Line
          dataKey="pageViews"
          dot={false}
          isAnimationActive={false}
          name="pageViews"
          stroke="#10b981"
          strokeWidth={2}
          type="monotone"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
