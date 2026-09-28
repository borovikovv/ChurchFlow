/**
 * Private photos are linked through the web origin's `/v1` rewrite rather than the API origin, so
 * an `<img>` sends the session cookie and the route can check who is asking.
 */
const WEB_API_PREFIX = '/v1';

/**
 * Every upload gets a new asset id and object key and an asset is never rewritten in place, so the
 * id in the url is the version: a changed photo is a different url and the old bytes can be kept
 * for as long as the browser likes. `private` keeps them out of every shared cache (CDN, proxy,
 * Next), since whether a response may be served depends on the session that asked for it.
 */
export const PRIVATE_MEDIA_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'private, max-age=31536000, immutable',
};

export function organizationMediaContentUrl(organizationId: string, assetId: string): string {
  return `${WEB_API_PREFIX}/organizations/${organizationId}/media/${assetId}/content`;
}

export function currentUserAvatarContentUrl(assetId: string): string {
  return `${WEB_API_PREFIX}/users/me/avatar/${assetId}`;
}
