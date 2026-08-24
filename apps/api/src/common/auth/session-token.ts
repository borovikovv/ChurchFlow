import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { AUTH_COOKIE_NAMES } from '@churchflow/shared';

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
