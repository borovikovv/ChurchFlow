import type { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAMES } from '@churchflow/shared';
import { serverEnv } from '@/env/server';

const CLEARED_COOKIE_NAMES = [
  AUTH_COOKIE_NAMES.session,
  // Cookies from the previous access/refresh scheme. They expire on their own within a
  // month, so this list can shrink to the session cookie one release after the cutover.
  AUTH_COOKIE_NAMES.access,
  AUTH_COOKIE_NAMES.refresh,
] as const;

// Only route handlers may write cookies, so every path that ends a session funnels
// through one of them rather than clearing cookies during a render.
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
