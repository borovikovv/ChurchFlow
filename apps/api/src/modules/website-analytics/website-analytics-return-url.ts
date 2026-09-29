import { WEBSITE_ANALYTICS_CONNECT_PARAMS } from '@churchflow/shared';
import type { GoogleOAuthCompletion } from './website-analytics.service';

/** The dashboard analytics page the owner lands on after the Google consent round trip. */
export function websiteAnalyticsReturnUrl(
  webAppUrl: string,
  organizationId: string,
  completion: GoogleOAuthCompletion,
): string {
  const url = new URL(
    `/dashboard/${encodeURIComponent(organizationId)}/website/analytics`,
    webAppUrl,
  );
  url.searchParams.set(
    WEBSITE_ANALYTICS_CONNECT_PARAMS.result,
    completion.ok ? 'connected' : 'error',
  );
  if (!completion.ok)
    url.searchParams.set(WEBSITE_ANALYTICS_CONNECT_PARAMS.reason, completion.reason);

  return url.toString();
}
