import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAMES } from '@churchflow/shared';

export function middleware(request: NextRequest): NextResponse {
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard');
  const hasAccessCookie = request.cookies.has(AUTH_COOKIE_NAMES.access);

  if (isDashboard && !hasAccessCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*']
};
