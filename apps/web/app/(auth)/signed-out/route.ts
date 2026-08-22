import { NextResponse, type NextRequest } from 'next/server';
import { clearAuthCookies } from '@/auth/auth-cookies';
import { internalRedirectTarget } from '@/auth/route-policy';
import { serverEnv } from '@/env/server';
import { APP_ROUTES } from '@/routes';

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
