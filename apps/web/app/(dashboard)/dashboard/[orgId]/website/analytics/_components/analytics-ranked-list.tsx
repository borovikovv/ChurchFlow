import { toRankedBars } from '../analytics-report-view';
import type { WebsiteAnalyticsRankedRow } from '@churchflow/shared';

export function AnalyticsRankedList({
  emptyLabel,
  locale,
  rows,
  title,
}: {
  emptyLabel: string;
  locale: string;
  rows: WebsiteAnalyticsRankedRow[];
  title: string;
}) {
  const numberFormat = new Intl.NumberFormat(locale);

  return (
    <section className="grid content-start gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="m-0 text-base">{title}</h2>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-[var(--muted)]">{emptyLabel}</p>
      ) : (
        <ol className="m-0 grid list-none gap-2 p-0">
          {toRankedBars(rows).map((row) => (
            <li className="grid gap-1" key={row.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate" title={row.label}>
                  {row.label}
                </span>
                <span className="shrink-0 tabular-nums text-[var(--muted)]">
                  {numberFormat.format(row.value)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--surface-subtle)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${String(row.percent)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
