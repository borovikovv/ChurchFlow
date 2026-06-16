import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAMES } from '@churchflow/shared';
import { serverEnv } from '@/env/server';

interface VerifyEmailLoginResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  redirectTo: string;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const response = await fetch(`${serverEnv.API_INTERNAL_URL}/auth/email/verify`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
    cache: 'no-store',
  });

  if (!response.ok) {
    return NextResponse.redirect(new URL('/login?error=invalid-link', request.url));
  }

  const result = (await response.json()) as VerifyEmailLoginResult;
  const redirectTo = result.redirectTo.startsWith('/') && !result.redirectTo.startsWith('//')
    ? result.redirectTo
    : '/';
  const redirectResponse = NextResponse.redirect(new URL(redirectTo, request.url));
  const secure = serverEnv.NODE_ENV === 'production';

  redirectResponse.cookies.set(AUTH_COOKIE_NAMES.access, result.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    expires: new Date(result.accessTokenExpiresAt),
  });
  redirectResponse.cookies.set(AUTH_COOKIE_NAMES.refresh, result.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    expires: new Date(result.refreshTokenExpiresAt),
  });

  return redirectResponse;
}
