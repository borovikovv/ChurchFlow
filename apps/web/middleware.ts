import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAMES, SESSION_IDLE_TTL_SECONDS } from './src/shared/edge';
import { internalRedirectTarget, isProtectedRoute } from './src/auth/route-policy';

// Session tokens are opaque, so middleware can only see whether a session cookie exists.
// Whether that session is still live is answered by the API, and pages send a rejected
// visitor to /signed-out, which is the only place the cookie is cleared.
export function middleware(request: NextRequest): NextResponse {
  const sessionToken = request.cookies.get(AUTH_COOKIE_NAMES.session)?.value;

  if (sessionToken) {
    const response = NextResponse.next();
    rollSessionCookie(response, sessionToken);

    return response;
  }

  if (!isProtectedRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set(
    'redirectTo',
    internalRedirectTarget(request.nextUrl.pathname, request.nextUrl.search),
  );

  return NextResponse.redirect(loginUrl);
}

// The API slides the session row's idle window, but its Set-Cookie never reaches the
// browser: pages talk to the API from the server. Middleware is the only place that
// answers the browser directly, so it mirrors the same window here. Without this the
// cookie would keep its sign-in expiry and outlive, or cut short, the session itself.
function rollSessionCookie(response: NextResponse, token: string): void {
  const cookieDomain = process.env['COOKIE_DOMAIN']?.trim();
  // Same attributes the API issues the cookie with, derived the same way: a cookie set
  // here with a different `secure` flag would quietly downgrade the one from sign-in.
  const secure =
    process.env['NEXT_PUBLIC_WEB_URL']?.startsWith('https://') === true ||
    process.env['NODE_ENV'] === 'production';

  response.cookies.set(AUTH_COOKIE_NAMES.session, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    expires: new Date(Date.now() + SESSION_IDLE_TTL_SECONDS * 1000),
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
}

export const config = {
  matcher: [
    '/((?!api(?:/|$)|v1(?:/|$)|_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$|manifest\\.webmanifest$|robots\\.txt$|sitemap\\.xml$|.*\\.(?:avif|css|eot|gif|ico|jpe?g|js|json|map|png|svg|ttf|webp|woff2?)$).*)',
  ],
};
