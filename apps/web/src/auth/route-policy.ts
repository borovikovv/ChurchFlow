const PUBLIC_EXACT_PATHS = new Set([
  '/',
  '/login',
  '/invitations/accept',
  '/member-claims/accept',
  '/platform-admin/bootstrap',
]);

const STATIC_EXACT_PATHS = new Set(['/favicon.ico', '/robots.txt', '/sitemap.xml']);
const STATIC_FILE_PATTERN =
  /\.(?:avif|css|eot|gif|ico|jpe?g|js|json|map|png|svg|ttf|webp|woff2?)$/i;

export function normalizeRoutePathname(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] ?? '/';
  let normalized = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;

  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized || '/';
}

function matchesSegment(pathname: string, segment: string): boolean {
  return pathname === segment || pathname.startsWith(`${segment}/`);
}

export function isStaticOrInternalPath(pathname: string): boolean {
  const normalized = normalizeRoutePathname(pathname);

  return (
    matchesSegment(normalized, '/_next') ||
    matchesSegment(normalized, '/api') ||
    matchesSegment(normalized, '/v1') ||
    STATIC_EXACT_PATHS.has(normalized) ||
    STATIC_FILE_PATTERN.test(normalized)
  );
}

export function isPublicRoute(pathname: string): boolean {
  const normalized = normalizeRoutePathname(pathname);

  return PUBLIC_EXACT_PATHS.has(normalized) || matchesSegment(normalized, '/o');
}

export function isProtectedRoute(pathname: string): boolean {
  const normalized = normalizeRoutePathname(pathname);

  if (isStaticOrInternalPath(normalized)) {
    return false;
  }

  // Fail closed: every new application page is protected until explicitly added above.
  return !isPublicRoute(normalized);
}
