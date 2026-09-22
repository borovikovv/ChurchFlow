/**
 * The route a published website links its media to, relative to the API's public base url. It is
 * the one place the path is written, so the handler and the links that point at it cannot drift.
 */
export const PUBLIC_WEBSITE_MEDIA_PATH = 'public/website-media';

/**
 * The headers the redirect carries.
 *
 * `Cache-Control` has to stay well inside the lifetime of the signature the redirect points at: a
 * cached redirect that outlives its target hands the next visitor an expired url and the image
 * fails. A minute leaves four of the five the signature lasts to the fetch that follows it, which
 * covers a slow crawler and a skewed clock, while still sparing the API most of the repeat fetches
 * one page full of images makes.
 *
 * `Cross-Origin-Resource-Policy` overrides the `same-origin` default helmet puts on every response.
 * A published website is served from the web origin and embeds these images from the API origin,
 * which is the entire purpose of the route.
 */
export const PUBLIC_WEBSITE_MEDIA_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'public, max-age=60',
  'Cross-Origin-Resource-Policy': 'cross-origin',
};

export function publicWebsiteMediaUrl(publicApiUrl: string, assetId: string): string {
  const base = publicApiUrl.endsWith('/') ? publicApiUrl : `${publicApiUrl}/`;

  return new URL(`${PUBLIC_WEBSITE_MEDIA_PATH}/${assetId}`, base).toString();
}
