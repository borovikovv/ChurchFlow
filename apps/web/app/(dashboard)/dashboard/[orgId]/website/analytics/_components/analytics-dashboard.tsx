'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  DEFAULT_WEBSITE_ANALYTICS_REPORT_RANGE,
  WEBSITE_ANALYTICS_REPORT_RANGES,
  websiteAnalyticsReportRangeSchema,
  type WebsiteAnalyticsReportRange,
} from '@churchflow/shared';
import { FormSelect } from '@/components/forms/form-select';
import { Button } from '@/components/ui/button';
import { useWebsiteAnalyticsReport } from '../_hooks/use-website-analytics-report';
import { AnalyticsRankedList } from './analytics-ranked-list';
import { AnalyticsTrendChart } from './analytics-trend-chart';

const cardClassName = 'rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4';

export function AnalyticsDashboard({
  organizationId,
  propertyId,
  onReauthRequired,
}: {
  organizationId: string;
  propertyId: string;
  onReauthRequired: () => void;
}) {
  const t = useTranslations('website.analytics');
  const locale = useLocale();
  const [range, setRange] = useState<WebsiteAnalyticsReportRange>(
    DEFAULT_WEBSITE_ANALYTICS_REPORT_RANGE,
  );
  const report = useWebsiteAnalyticsReport({ organizationId, propertyId, range, onReauthRequired });
  const numberFormat = new Intl.NumberFormat(locale);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FormSelect
          className="min-w-48"
          label={t('range')}
          value={range}
          onChange={(event) => {
            const parsed = websiteAnalyticsReportRangeSchema.safeParse(event.target.value);
            if (parsed.success) setRange(parsed.data);
          }}
        >
          {WEBSITE_ANALYTICS_REPORT_RANGES.map((option) => (
            <option key={option} value={option}>
              {t(`ranges.${option}`)}
            </option>
          ))}
        </FormSelect>
        <p className="m-0 max-w-xl text-xs text-[var(--muted)]">{t('consentNote')}</p>
      </div>

      {report.isPending ? (
        <p className="m-0 text-sm text-[var(--muted)]" role="status">
          {t('loadingReport')}
        </p>
      ) : null}

      {report.isError ? (
        <div className={`${cardClassName} grid justify-items-start gap-3`}>
          <p className="form-error m-0">
            {t('reportFailed')} {report.error.message}
          </p>
          <Button type="button" variant="secondary" onClick={() => void report.refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : null}

      {report.data ? (
        <>
          <section className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            {(
              [
                ['users', report.data.totals.users],
                ['pageViews', report.data.totals.pageViews],
                ['sessions', report.data.totals.sessions],
              ] as const
            ).map(([key, value]) => (
              <div className={cardClassName} key={key}>
                <p className="m-0 text-sm text-[var(--muted)]">{t(key)}</p>
                <p className="m-0 mt-1 text-2xl font-semibold tabular-nums">
                  {numberFormat.format(value)}
                </p>
              </div>
            ))}
          </section>

          <section className={cardClassName}>
            <h2 className="m-0 mb-3 text-base">{t('trend')}</h2>
            {report.data.totals.users === 0 && report.data.totals.pageViews === 0 ? (
              <p className="m-0 text-sm text-[var(--muted)]">{t('noData')}</p>
            ) : (
              <AnalyticsTrendChart
                labels={{ users: t('users'), pageViews: t('pageViews') }}
                locale={locale}
                trend={report.data.trend}
              />
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <AnalyticsRankedList
              emptyLabel={t('noData')}
              locale={locale}
              rows={report.data.topPages}
              title={t('topPages')}
            />
            <AnalyticsRankedList
              emptyLabel={t('noData')}
              locale={locale}
              rows={report.data.trafficSources}
              title={t('trafficSources')}
            />
            <AnalyticsRankedList
              emptyLabel={t('noData')}
              locale={locale}
              rows={report.data.countries}
              title={t('countries')}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
