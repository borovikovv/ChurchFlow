import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAMES } from './src/shared/edge';
import { internalRedirectTarget, isProtectedRoute } from './src/auth/route-policy';

// Session tokens are opaque, so middleware can only see whether a session cookie exists.
// Whether that session is still live is answered by the API, and pages send a rejected
// visitor to /signed-out, which is the only place the cookie is cleared.
export function middleware(request: NextRequest): NextResponse {
  if (request.cookies.has(AUTH_COOKIE_NAMES.session)) {
    return NextResponse.next();
  }

  if (!isProtectedRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set(
    'redirectTo',
    internalRedirectTarget(request.nextUrl.pathname, request.nextUrl.search),
  );

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!api(?:/|$)|v1(?:/|$)|_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$|manifest\\.webmanifest$|robots\\.txt$|sitemap\\.xml$|.*\\.(?:avif|css|eot|gif|ico|jpe?g|js|json|map|png|svg|ttf|webp|woff2?)$).*)',
  ],
};
