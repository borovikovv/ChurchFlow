import type { WebsiteAnalyticsPropertyTree, WebsiteAnalyticsRankedRow } from '@churchflow/shared';

export interface AnalyticsPropertyOption {
  id: string;
  label: string;
}

/** One option per property, named with its account so same-named properties stay apart. */
export function flattenAnalyticsProperties(
  tree: WebsiteAnalyticsPropertyTree,
): AnalyticsPropertyOption[] {
  return tree.accounts.flatMap((account) =>
    account.properties.map((property) => ({
      id: property.id,
      label: `${account.displayName || account.id} / ${property.displayName || property.id}`,
    })),
  );
}

export interface AnalyticsRankedBar extends WebsiteAnalyticsRankedRow {
  /** Bar length relative to the largest row, 0-100. */
  percent: number;
}

export function toRankedBars(rows: WebsiteAnalyticsRankedRow[]): AnalyticsRankedBar[] {
  const max = Math.max(0, ...rows.map((row) => row.value));

  return rows.map((row) => ({
    ...row,
    percent: max > 0 ? Math.round((row.value / max) * 100) : 0,
  }));
}

/** `2026-09-29` as a short day label; the date is a calendar day, so it is read in UTC. */
export function formatTrendDay(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}
