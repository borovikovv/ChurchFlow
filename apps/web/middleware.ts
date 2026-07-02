import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAMES } from '@churchflow/shared';
import {
  internalRedirectTarget,
  isAccessTokenFresh,
  setCookieHeader,
} from './src/auth/middleware-session';
import { isProtectedRoute } from './src/auth/route-policy';

interface RefreshAccessTokenResult {
  accessToken: string;
  accessTokenExpiresAt: string;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const protectedRoute = isProtectedRoute(request.nextUrl.pathname);
  const accessToken = request.cookies.get(AUTH_COOKIE_NAMES.access)?.value;
  const refreshToken = request.cookies.get(AUTH_COOKIE_NAMES.refresh)?.value;

  if (
    accessToken &&
    (await isAccessTokenFresh(accessToken, process.env['JWT_ACCESS_PUBLIC_KEY']))
  ) {
    return NextResponse.next();
  }

  if (refreshToken) {
    const refreshed = await refreshAccessToken(request);
    if (refreshed) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(
        'cookie',
        setCookieHeader(
          request.headers.get('cookie'),
          AUTH_COOKIE_NAMES.access,
          refreshed.accessToken,
        ),
      );
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.cookies.set(
        AUTH_COOKIE_NAMES.access,
        refreshed.accessToken,
        authCookieOptions(request, refreshed.accessTokenExpiresAt),
      );

      return response;
    }

    return unauthenticatedResponse(request, protectedRoute, true);
  }

  return unauthenticatedResponse(request, protectedRoute, Boolean(accessToken));
}

function unauthenticatedResponse(
  request: NextRequest,
  protectedRoute: boolean,
  clearCookies: boolean,
): NextResponse {
  if (!protectedRoute) {
    const response = NextResponse.next();
    if (clearCookies) clearAuthCookies(response, request);
    return response;
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set(
    'redirectTo',
    internalRedirectTarget(request.nextUrl.pathname, request.nextUrl.search),
  );
  const response = NextResponse.redirect(loginUrl);
  if (clearCookies) clearAuthCookies(response, request);

  return response;
}

export const config = {
  matcher: [
    '/((?!api(?:/|$)|v1(?:/|$)|_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$|.*\\.(?:avif|css|eot|gif|ico|jpe?g|js|json|map|png|svg|ttf|webp|woff2?)$).*)',
  ],
};

function clearAuthCookies(response: NextResponse, request: NextRequest): void {
  const options = authCookieOptions(request);
  response.cookies.set(AUTH_COOKIE_NAMES.access, '', { ...options, expires: new Date(0) });
  response.cookies.set(AUTH_COOKIE_NAMES.refresh, '', { ...options, expires: new Date(0) });
}

function authCookieOptions(request: NextRequest, expiresAt?: string) {
  const domain = process.env['COOKIE_DOMAIN'];

  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: request.nextUrl.protocol === 'https:' || process.env['NODE_ENV'] === 'production',
    path: '/',
    ...(expiresAt ? { expires: new Date(expiresAt) } : {}),
    ...(domain ? { domain } : {}),
  };
}

async function refreshAccessToken(
  request: NextRequest,
): Promise<RefreshAccessTokenResult | undefined> {
  const baseUrl =
    process.env['API_INTERNAL_URL'] ??
    process.env['NEXT_PUBLIC_API_URL'] ??
    (process.env['NODE_ENV'] === 'production' ? undefined : 'http://localhost:4000/v1');
  if (!baseUrl) {
    return undefined;
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
