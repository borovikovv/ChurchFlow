import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { AUTH_COOKIE_NAMES } from '@churchflow/shared';

// Shared by the guard that authenticates a session and the logout route that revokes one.
// If the two disagreed on precedence, logout would end a different session than the one
// the caller is actually using.
export function sessionTokenFromRequest(request: Request): string | undefined {
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (bearer) {
    return bearer;
  }

  return parseCookies(request.headers.cookie)[AUTH_COOKIE_NAMES.session];
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, cookie) => {
    const [name, ...value] = cookie.trim().split('=');
    if (name) {
      cookies[name] = decodeURIComponent(value.join('='));
    }
    return cookies;
  }, {});
}
