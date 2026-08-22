import type { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

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
