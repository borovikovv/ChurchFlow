import type {
  WEBSITE_ANALYTICS_CONNECT_FAILURES,
  WEBSITE_ANALYTICS_CONNECT_RESULTS,
} from '@churchflow/shared';

export type AnalyticsActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string };

export type AnalyticsConnectFeedback =
  | { result: Extract<(typeof WEBSITE_ANALYTICS_CONNECT_RESULTS)[number], 'connected'> }
  | {
      result: Extract<(typeof WEBSITE_ANALYTICS_CONNECT_RESULTS)[number], 'error'>;
      reason: (typeof WEBSITE_ANALYTICS_CONNECT_FAILURES)[number];
    };
