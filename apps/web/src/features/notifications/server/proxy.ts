import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAMES } from '@churchflow/shared';
import { setCookieHeader } from '@/auth/middleware-session';
import { serverEnv } from '@/env/server';

interface RefreshAccessTokenResult {
  accessToken: string;
  accessTokenExpiresAt: string;
}

export async function proxyApiRequest(path: string, init: RequestInit = {}): Promise<NextResponse> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  try {
    const response = await sendApiRequest(path, init, cookieHeader);
    if (response.status !== 401) {
      return apiResponse(response);
    }

    const refreshed = await refreshAccessToken(cookieHeader);
    if (!refreshed) {
      return apiResponse(response, { clearAuthCookies: true });
    }

    const retryCookieHeader = setCookieHeader(
      cookieHeader,
      AUTH_COOKIE_NAMES.access,
      refreshed.accessToken,
    );
    const retryResponse = await sendApiRequest(path, init, retryCookieHeader);

    return apiResponse(retryResponse, { refreshed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'API request failed';
    return NextResponse.json(
      { ok: false, error: { code: 'API_UNREACHABLE', message } },
      { status: 502 },
    );
  }
}

async function sendApiRequest(
  path: string,
  init: RequestInit,
  cookieHeader: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('accept', headers.get('accept') ?? 'application/json');
  headers.set('cookie', cookieHeader);

  return fetch(`${serverEnv.API_INTERNAL_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
}

async function apiResponse(
  apiResponse: Response,
  options: {
    refreshed?: RefreshAccessTokenResult;
    clearAuthCookies?: boolean;
  } = {},
): Promise<NextResponse> {
  const body = await apiResponse.text();
  const response = new NextResponse(body, {
    status: apiResponse.status,
    headers: {
      'content-type': apiResponse.headers.get('content-type') ?? 'application/json',
    },
  });

  if (options.refreshed) {
    response.cookies.set(
      AUTH_COOKIE_NAMES.access,
      options.refreshed.accessToken,
      authCookieOptions(options.refreshed.accessTokenExpiresAt),
    );
  }

  if (options.clearAuthCookies) {
    const cookieOptions = authCookieOptions();
    response.cookies.set(AUTH_COOKIE_NAMES.access, '', { ...cookieOptions, expires: new Date(0) });
    response.cookies.set(AUTH_COOKIE_NAMES.refresh, '', { ...cookieOptions, expires: new Date(0) });
  }

  return response;
}

async function refreshAccessToken(
  cookieHeader: string,
): Promise<RefreshAccessTokenResult | undefined> {
  const response = await fetch(`${serverEnv.API_INTERNAL_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      cookie: cookieHeader,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return undefined;
  }

  const body = (await response.json()) as unknown;
  if (
    isRecord(body) &&
    typeof body['accessToken'] === 'string' &&
    typeof body['accessTokenExpiresAt'] === 'string'
  ) {
    return {
      accessToken: body['accessToken'],
      accessTokenExpiresAt: body['accessTokenExpiresAt'],
    };
  }

  return undefined;
}

function authCookieOptions(expiresAt?: string) {
  const domain = process.env['COOKIE_DOMAIN'];

  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    ...(expiresAt ? { expires: new Date(expiresAt) } : {}),
    ...(domain ? { domain } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
