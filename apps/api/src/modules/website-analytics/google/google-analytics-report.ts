import {
  isValidTimeZone,
  type WebsiteAnalyticsRankedRow,
  type WebsiteAnalyticsReport,
  type WebsiteAnalyticsReportRange,
  type WebsiteAnalyticsTrendPoint,
} from '@churchflow/shared';
import type { GoogleReport } from './google-analytics.client';

const RANKED_ROW_LIMIT = 10;
const NOT_SET_LABEL = '(not set)';

export const REPORT_RANGE_DAYS: Record<WebsiteAnalyticsReportRange, number> = {
  '7d': 7,
  '28d': 28,
  '90d': 90,
};

/**
 * The five GA4 Data API reports behind the dashboard, in the order the mapper reads them. The
 * range ends today in the property's own time zone, which is how GA itself counts days.
 */
export function buildReportRequests(range: WebsiteAnalyticsReportRange): object[] {
  const dateRanges = [
    { startDate: `${String(REPORT_RANGE_DAYS[range] - 1)}daysAgo`, endDate: 'today' },
  ];
  const ranked = (dimension: string, metric: string) => ({
    dateRanges,
    dimensions: [{ name: dimension }],
    metrics: [{ name: metric }],
    orderBys: [{ metric: { metricName: metric }, desc: true }],
    limit: RANKED_ROW_LIMIT,
  });

  return [
    {
      dateRanges,
      metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'sessions' }],
    },
    {
      dateRanges,
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    },
    ranked('pagePath', 'screenPageViews'),
    ranked('sessionDefaultChannelGroup', 'sessions'),
    ranked('country', 'activeUsers'),
  ];
}

export function toWebsiteAnalyticsReport(
  range: WebsiteAnalyticsReportRange,
  reports: GoogleReport[],
  now: Date,
): WebsiteAnalyticsReport {
  const [totalsReport, trendReport, pagesReport, sourcesReport, countriesReport] = reports;
  const totalsRow = totalsReport?.rows[0];
  const timeZone = trendReport?.metadata.timeZone ?? totalsReport?.metadata.timeZone ?? 'UTC';

  return {
    range,
    totals: {
      users: metricAt(totalsRow, 0),
      pageViews: metricAt(totalsRow, 1),
      sessions: metricAt(totalsRow, 2),
    },
    trend: toTrend(trendReport, REPORT_RANGE_DAYS[range], timeZone, now),
    topPages: toRanked(pagesReport),
    trafficSources: toRanked(sourcesReport),
    countries: toRanked(countriesReport),
    generatedAt: now.toISOString(),
  };
}

/** GA leaves out days nobody visited; the chart needs every day of the range, zero or not. */
function toTrend(
  report: GoogleReport | undefined,
  days: number,
  timeZone: string,
  now: Date,
): WebsiteAnalyticsTrendPoint[] {
  const byDate = new Map<string, { users: number; pageViews: number }>();
  for (const row of report?.rows ?? []) {
    const date = fromGaDate(row.dimensionValues[0]?.value ?? '');
    if (date) byDate.set(date, { users: metricAt(row, 0), pageViews: metricAt(row, 1) });
  }

  const today = calendarDayIn(timeZone, now);
  return Array.from({ length: days }, (_, index) => {
    const date = shiftCalendarDay(today, index - (days - 1));
    return { date, ...(byDate.get(date) ?? { users: 0, pageViews: 0 }) };
  });
}

function toRanked(report: GoogleReport | undefined): WebsiteAnalyticsRankedRow[] {
  return (report?.rows ?? []).slice(0, RANKED_ROW_LIMIT).map((row) => ({
    label: row.dimensionValues[0]?.value.trim() || NOT_SET_LABEL,
    value: metricAt(row, 0),
  }));
}

function metricAt(row: GoogleReport['rows'][number] | undefined, index: number): number {
  const value = Number(row?.metricValues[index]?.value ?? 0);

  return Number.isFinite(value) ? value : 0;
}

/** `20260929` -> `2026-09-29`. */
function fromGaDate(value: string): string | null {
  if (!/^\d{8}$/.test(value)) return null;

  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function calendarDayIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: isValidTimeZone(timeZone) ? timeZone : 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function shiftCalendarDay(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);

  return date.toISOString().slice(0, 10);
}
