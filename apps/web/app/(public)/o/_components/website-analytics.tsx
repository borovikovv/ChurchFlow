import Script from 'next/script';
import type { AppLocale } from '@churchflow/shared';
import { analyticsBootstrapScript, publicMeasurementId } from '../_lib/website-analytics-consent';
import { AnalyticsConsentBanner } from './analytics-consent-banner';

/**
 * The organization's Google Analytics tag with its consent banner. Rendered by the public pages
 * only: the editor preview is a separate route, so an owner editing the site is never counted.
 */
export function WebsiteAnalytics({
  analytics,
  locale,
  orgSlug,
}: {
  analytics: { measurementId: string } | null | undefined;
  locale: AppLocale;
  orgSlug: string;
}) {
  const measurementId = publicMeasurementId(analytics?.measurementId);
  if (!measurementId) return null;

  return (
    <>
      {/* next/script runs an id once per client session; keying it by site lets a link to another
          church's site configure that site's tag too. */}
      <Script id={`churchflow-analytics-${orgSlug}`} strategy="afterInteractive">
        {analyticsBootstrapScript({ measurementId, orgSlug })}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <AnalyticsConsentBanner locale={locale} orgSlug={orgSlug} />
    </>
  );
}
