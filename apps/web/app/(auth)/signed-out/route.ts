import { NextResponse, type NextRequest } from 'next/server';
import { clearAuthCookies } from '@/auth/auth-cookies';
import { internalRedirectTarget } from '@/auth/route-policy';
import { serverEnv } from '@/env/server';
import { APP_ROUTES } from '@/routes';

// Where server components send a visitor whose session the API rejected: a render cannot
// clear cookies, so it redirects here and this handler does it before reaching /login.
//
// Clearing cookies is a state change reached by navigation, so a cross-site page must not
// be able to trigger it with an image tag or a link. Requests that carry an origin have to
// carry ours; same-origin navigations send none and are allowed through.
export function GET(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(serverEnv.NEXT_PUBLIC_WEB_URL).origin) {
    return new NextResponse(null, { status: 403 });
  }

  const requestedRedirect = request.nextUrl.searchParams.get('redirectTo');
  const loginUrl = new URL(APP_ROUTES.login, request.url);

  if (requestedRedirect) {
    loginUrl.searchParams.set('redirectTo', internalRedirectTarget(requestedRedirect, ''));
  }

  const response = NextResponse.redirect(loginUrl);
  clearAuthCookies(response);

  return response;
}
