'use client';

import { useQuery } from '@tanstack/react-query';
import {
  WEBSITE_ANALYTICS_ERROR_CODES,
  type WebsiteAnalyticsReportRange,
} from '@churchflow/shared';
import { loadWebsiteAnalyticsReportAction } from '../actions';
import { AnalyticsActionError } from '../analytics-action-error';

const WEBSITE_ANALYTICS_REPORT_QUERY_KEY = 'website-analytics-report';

export function websiteAnalyticsReportsQueryKey(organizationId: string) {
  return [WEBSITE_ANALYTICS_REPORT_QUERY_KEY, organizationId] as const;
}

export function useWebsiteAnalyticsReport({
  organizationId,
  propertyId,
  range,
  onReauthRequired,
}: {
  organizationId: string;
  propertyId: string;
  range: WebsiteAnalyticsReportRange;
  onReauthRequired: () => void;
}) {
  return useQuery({
    queryKey: [...websiteAnalyticsReportsQueryKey(organizationId), propertyId, range],
    queryFn: async () => {
      const result = await loadWebsiteAnalyticsReportAction({ organizationId, range });
      if (!result.ok) {
        if (result.code === WEBSITE_ANALYTICS_ERROR_CODES.reauthRequired) onReauthRequired();
        throw new AnalyticsActionError(result.error, result.code);
      }
      return result.data;
    },
    // The API caches reports for ten minutes; refetching sooner only returns the same numbers.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
