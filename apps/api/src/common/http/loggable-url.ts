const SENSITIVE_QUERY_PARAMS = ['code', 'state'];

/**
 * The request url as it may be logged. OAuth providers return the authorization code and state in
 * the query string of a callback, and either is enough to finish someone else's sign-in.
 */
export function loggableUrl(originalUrl: string): string {
  const queryStart = originalUrl.indexOf('?');
  if (queryStart === -1) return originalUrl;

  const params = new URLSearchParams(originalUrl.slice(queryStart + 1));
  for (const name of SENSITIVE_QUERY_PARAMS) {
    if (params.has(name)) params.set(name, 'redacted');
  }

  return `${originalUrl.slice(0, queryStart)}?${params.toString()}`;
}
