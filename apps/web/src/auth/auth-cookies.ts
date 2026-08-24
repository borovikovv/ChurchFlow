import type { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAMES } from '@churchflow/shared';
import { serverEnv } from '@/env/server';

const CLEARED_COOKIE_NAMES = [
  AUTH_COOKIE_NAMES.session,
  AUTH_COOKIE_NAMES.access,
  AUTH_COOKIE_NAMES.refresh,
] as const;

export function clearAuthCookies(response: NextResponse): void {
  const cookieDomain = serverEnv.COOKIE_DOMAIN?.trim();
  const secure =
    serverEnv.NEXT_PUBLIC_WEB_URL.startsWith('https://') || serverEnv.NODE_ENV === 'production';

  for (const name of CLEARED_COOKIE_NAMES) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      expires: new Date(0),
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    });
  }
}
