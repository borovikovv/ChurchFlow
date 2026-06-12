import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { AUTH_COOKIE_NAMES, type ApiResult } from '@churchflow/shared';
import { serverEnv } from '@/env/server';

interface VerifyEmailLoginResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  redirectTo: string;
}

export default async function VerifyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    redirect('/login' as Route);
  }

  const response = await fetch(`${serverEnv.API_INTERNAL_URL}/auth/email/verify`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
    cache: 'no-store',
  });

  if (!response.ok) {
    redirect('/login?error=invalid-link' as Route);
  }

  const result = (await response.json()) as ApiResult<VerifyEmailLoginResult>;
  if (!result.ok) {
    redirect('/login?error=invalid-link' as Route);
  }

  const cookieStore = await cookies();
  const secure = serverEnv.NODE_ENV === 'production';
  cookieStore.set(AUTH_COOKIE_NAMES.access, result.data.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    expires: new Date(result.data.accessTokenExpiresAt),
  });
  cookieStore.set(AUTH_COOKIE_NAMES.refresh, result.data.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    expires: new Date(result.data.refreshTokenExpiresAt),
  });

  redirect(result.data.redirectTo as Route);
}
