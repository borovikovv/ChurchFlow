'use server';

import { apiFetch } from '@/api/client';
import type {
  ApiResult,
  SelectWebsiteAnalyticsPropertyInput,
  WebsiteAnalyticsDataStreamList,
  WebsiteAnalyticsIntegrationStatus,
  WebsiteAnalyticsPropertyTree,
  WebsiteAnalyticsReport,
  WebsiteAnalyticsReportRange,
} from '@churchflow/shared';
import type { AnalyticsActionResult } from './types';

const jsonHeaders = { 'content-type': 'application/json' };

function analyticsPath(organizationId: string) {
  return `/organizations/${organizationId}/website/analytics`;
}

export async function loadWebsiteAnalyticsReportAction(input: {
  organizationId: string;
  range: WebsiteAnalyticsReportRange;
}): Promise<AnalyticsActionResult<WebsiteAnalyticsReport>> {
  const query = new URLSearchParams({ range: input.range });

  return toActionResult(
    await apiFetch<WebsiteAnalyticsReport>(
      `${analyticsPath(input.organizationId)}/report?${query.toString()}`,
    ),
  );
}

export async function listWebsiteAnalyticsPropertiesAction(input: {
  organizationId: string;
}): Promise<AnalyticsActionResult<WebsiteAnalyticsPropertyTree>> {
  return toActionResult(
    await apiFetch<WebsiteAnalyticsPropertyTree>(
      `${analyticsPath(input.organizationId)}/google/properties`,
    ),
  );
}

export async function listWebsiteAnalyticsDataStreamsAction(input: {
  organizationId: string;
  propertyId: string;
}): Promise<AnalyticsActionResult<WebsiteAnalyticsDataStreamList>> {
  return toActionResult(
    await apiFetch<WebsiteAnalyticsDataStreamList>(
      `${analyticsPath(input.organizationId)}/google/properties/${encodeURIComponent(input.propertyId)}/data-streams`,
    ),
  );
}

export async function selectWebsiteAnalyticsPropertyAction(
  input: SelectWebsiteAnalyticsPropertyInput & { organizationId: string },
): Promise<AnalyticsActionResult<WebsiteAnalyticsIntegrationStatus>> {
  const result = await apiFetch<WebsiteAnalyticsIntegrationStatus>(
    `${analyticsPath(input.organizationId)}/property`,
    {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ propertyId: input.propertyId, streamId: input.streamId }),
    },
  );

  return toActionResult(result);
}

export async function setWebsiteAnalyticsMeasurementIdAction(input: {
  organizationId: string;
  measurementId: string;
}): Promise<AnalyticsActionResult<WebsiteAnalyticsIntegrationStatus>> {
  const result = await apiFetch<WebsiteAnalyticsIntegrationStatus>(
    `${analyticsPath(input.organizationId)}/measurement-id`,
    {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ measurementId: input.measurementId }),
    },
  );

  return toActionResult(result);
}

export async function disconnectWebsiteAnalyticsAction(input: {
  organizationId: string;
}): Promise<AnalyticsActionResult<WebsiteAnalyticsIntegrationStatus>> {
  const result = await apiFetch<WebsiteAnalyticsIntegrationStatus>(
    analyticsPath(input.organizationId),
    { method: 'DELETE' },
  );

  return toActionResult(result);
}

function toActionResult<T>(result: ApiResult<T>): AnalyticsActionResult<T> {
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, error: result.error.message, code: result.error.code };
}
