import { NextResponse, type NextRequest } from 'next/server';
import { clearAuthCookies } from '@/auth/auth-cookies';
import { internalRedirectTarget } from '@/auth/route-policy';
import { APP_ROUTES } from '@/routes';

// Where server components send a visitor whose session the API rejected: a render cannot
// clear cookies, so it redirects here and this handler does it before reaching /login.
export function GET(request: NextRequest): NextResponse {
  const requestedRedirect = request.nextUrl.searchParams.get('redirectTo');
  const loginUrl = new URL(APP_ROUTES.login, request.url);

  if (requestedRedirect) {
    loginUrl.searchParams.set('redirectTo', internalRedirectTarget(requestedRedirect, ''));
  }

  const response = NextResponse.redirect(loginUrl);
  clearAuthCookies(response);

  return response;
}
