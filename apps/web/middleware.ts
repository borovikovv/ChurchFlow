import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAMES } from '@churchflow/shared';

interface RefreshAccessTokenResult {
  accessToken: string;
  accessTokenExpiresAt: string;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAMES.access)?.value;
  const refreshToken = request.cookies.get(AUTH_COOKIE_NAMES.refresh)?.value;

  if (accessToken && isAccessTokenFresh(accessToken)) {
    return NextResponse.next();
  }

  if (refreshToken) {
    const refreshed = await refreshAccessToken(request);
    if (refreshed) {
      const response = NextResponse.next();
      response.cookies.set(AUTH_COOKIE_NAMES.access, refreshed.accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:' || process.env['NODE_ENV'] === 'production',
        path: '/',
        expires: new Date(refreshed.accessTokenExpiresAt),
      });

      return response;
    }
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirectTo', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(AUTH_COOKIE_NAMES.access);

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/profile', '/invitations/pending'],
};

async function refreshAccessToken(
  request: NextRequest,
): Promise<RefreshAccessTokenResult | undefined> {
  const baseUrl =
    process.env['API_INTERNAL_URL'] ??
    process.env['NEXT_PUBLIC_API_URL'] ??
    'http://localhost:4000/v1';
  const cookie = request.headers.get('cookie');

  try {
    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        ...(cookie ? { cookie } : {}),
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
  } catch {
    return undefined;
  }

  return undefined;
}

function isAccessTokenFresh(token: string): boolean {
  const [, payload] = token.split('.');
  if (!payload) {
    return false;
  }

  try {
    const decoded = JSON.parse(base64UrlDecode(payload)) as unknown;

    return (
      isRecord(decoded) &&
      typeof decoded['exp'] === 'number' &&
      decoded['exp'] > Math.floor(Date.now() / 1000) + 5
    );
  } catch {
    return false;
  }
}

function base64UrlDecode(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

  return atob(padded);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
