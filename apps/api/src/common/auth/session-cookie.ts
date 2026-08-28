import type { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { AUTH_COOKIE_NAMES } from '@churchflow/shared';

export function sessionCookieOptions(config: ConfigService): CookieOptions {
  const cookieDomain = config.get<string>('COOKIE_DOMAIN')?.trim();
  const isHttpsApp = config.getOrThrow<string>('WEB_APP_URL').startsWith('https://');

  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isHttpsApp || config.get<string>('NODE_ENV') === 'production',
    path: '/',
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
}

export function setSessionCookie(
  response: Response,
  config: ConfigService,
  input: { sessionToken: string; sessionExpiresAt: Date },
): void {
  response.cookie(AUTH_COOKIE_NAMES.session, input.sessionToken, {
    ...sessionCookieOptions(config),
    expires: input.sessionExpiresAt,
  });
}
