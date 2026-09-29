import {
  WEBSITE_ANALYTICS_CONNECT_FAILURES,
  WEBSITE_ANALYTICS_CONNECT_PARAMS,
} from '@churchflow/shared';
import type { AnalyticsConnectFeedback } from './types';

type SearchParams = Record<string, string | string[] | undefined>;

/** The outcome the API appended when it sent the owner back from Google, if any. */
export function readAnalyticsConnectFeedback(
  searchParams: SearchParams,
): AnalyticsConnectFeedback | null {
  const result = searchParams[WEBSITE_ANALYTICS_CONNECT_PARAMS.result];
  if (result === 'connected') return { result: 'connected' };
  if (result !== 'error') return null;

  const reason = searchParams[WEBSITE_ANALYTICS_CONNECT_PARAMS.reason];
  const known = WEBSITE_ANALYTICS_CONNECT_FAILURES.find((failure) => failure === reason);

  return { result: 'error', reason: known ?? 'exchange' };
}
