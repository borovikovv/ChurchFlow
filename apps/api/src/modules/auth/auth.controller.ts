import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AUTH_COOKIE_NAMES, type UserSession } from '@churchflow/shared';
import type { CookieOptions, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { sessionCookieOptions } from '../../common/auth/session-cookie';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../../common/guards/session-auth.guard';
import { AuthService } from './auth.service';
import { ProviderLoginDto, providerLoginSchema } from './dto/provider-login.dto';

const TELEGRAM_STATE_COOKIE = 'churchflow_telegram_state';
const TELEGRAM_VERIFIER_COOKIE = 'churchflow_telegram_verifier';
const TELEGRAM_NONCE_COOKIE = 'churchflow_telegram_nonce';
const TELEGRAM_REDIRECT_COOKIE = 'churchflow_telegram_redirect';

interface AuthUserResult {
  id: string;
  email: string | null;
  displayName: string | null;
  platformRole: string;
}

interface BeginTelegramLoginResult {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
  nonce: string;
  redirectTo?: string;
}

interface CompleteTelegramLoginResult {
  user: AuthUserResult;
  sessionToken: string;
  sessionExpiresAt: Date;
  redirectTo: string;
}

interface ProviderLoginRequest {
  provider: 'telegram';
  providerToken: string;
  redirectTo?: string;
}

interface SessionClientContext {
  userAgent?: string;
  ipAddress?: string;
}

interface AuthControllerService {
  beginProviderLogin(input: ProviderLoginRequest): { provider: string };
  beginTelegramLogin(input: { redirectTo?: string }): BeginTelegramLoginResult;
  completeTelegramLogin(input: {
    code: string;
    state: string;
    expectedState: string;
    codeVerifier: string;
    expectedNonce: string;
    redirectTo?: string;
    client: SessionClientContext;
  }): Promise<CompleteTelegramLoginResult>;
  logoutByToken(sessionToken: string): Promise<{ ok: true }>;
  listSessions(userId: string, currentSessionId: string): Promise<UserSession[]>;
  revokeSession(userId: string, sessionId: string): Promise<{ ok: true }>;
  revokeOtherSessions(userId: string, currentSessionId: string): Promise<{ revokedCount: number }>;
}

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthControllerService,
    private readonly config: ConfigService,
  ) {}

  @Post('provider')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  providerLogin(@Body() body: ProviderLoginDto): { provider: string } {
    const parsed = providerLoginSchema.parse(body);
    const input: ProviderLoginRequest = {
      provider: parsed.provider,
      providerToken: parsed.providerToken,
      ...(parsed.redirectTo ? { redirectTo: parsed.redirectTo } : {}),
    };

    return this.authService.beginProviderLogin(input);
  }

  @Get('telegram/start')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  startTelegramLogin(
    @Query('redirectTo') redirectTo: string | undefined,
    @Res() response: Response,
  ): void {
    const result = this.authService.beginTelegramLogin({
      ...(redirectTo ? { redirectTo } : {}),
    });

    response.cookie(TELEGRAM_STATE_COOKIE, result.state, this.telegramCookieOptions);
    response.cookie(TELEGRAM_VERIFIER_COOKIE, result.codeVerifier, this.telegramCookieOptions);
    response.cookie(TELEGRAM_NONCE_COOKIE, result.nonce, this.telegramCookieOptions);
    if (result.redirectTo) {
      response.cookie(TELEGRAM_REDIRECT_COOKIE, result.redirectTo, this.telegramCookieOptions);
    } else {
      response.clearCookie(TELEGRAM_REDIRECT_COOKIE, this.telegramCookieOptions);
    }

    response.redirect(result.authorizationUrl);
  }

  @Get('telegram/callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async completeTelegramLogin(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const cookies = this.parseCookies(request.headers.cookie);
    const expectedState = cookies[TELEGRAM_STATE_COOKIE];
    const codeVerifier = cookies[TELEGRAM_VERIFIER_COOKIE];
    const expectedNonce = cookies[TELEGRAM_NONCE_COOKIE];
    const redirectTo = cookies[TELEGRAM_REDIRECT_COOKIE];

    this.clearTelegramCookies(response);

    if (error || !code || !state || !expectedState || !codeVerifier || !expectedNonce) {
      response.redirect(this.loginUrl(error ?? 'Telegram login was not completed'));
      return;
    }

    try {
      const result = await this.authService.completeTelegramLogin({
        code,
        state,
        expectedState,
        codeVerifier,
        expectedNonce,
        ...(redirectTo ? { redirectTo } : {}),
        client: this.sessionClientContext(request),
      });
      this.setAuthCookies(response, result);
      response.redirect(new URL(result.redirectTo, this.webAppUrl).toString());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Telegram login failed';
      response.redirect(this.loginUrl(message));
    }
  }

  // Deliberately unguarded: a session that already lapsed must still be able to log out,
  // otherwise the browser keeps a cookie it can never clear. Revocation is best effort,
  // clearing the cookies is not.
  @Post('logout')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: true }> {
    const token = this.sessionToken(request);
    if (token) {
      await this.authService.logoutByToken(token);
    }

    this.clearAuthCookies(response);
    return { ok: true };
  }

  @Get('sessions')
  @UseGuards(SessionAuthGuard)
  listSessions(@Req() request: AuthenticatedRequest): Promise<UserSession[]> {
    const auth = this.authContext(request);

    return this.authService.listSessions(auth.userId, auth.sessionId);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(SessionAuthGuard)
  revokeSession(
    @Param('sessionId') sessionId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ ok: true }> {
    return this.authService.revokeSession(this.authContext(request).userId, sessionId);
  }

  @Post('sessions/revoke-others')
  @UseGuards(SessionAuthGuard)
  revokeOtherSessions(@Req() request: AuthenticatedRequest): Promise<{ revokedCount: number }> {
    const auth = this.authContext(request);

    return this.authService.revokeOtherSessions(auth.userId, auth.sessionId);
  }

  private authContext(request: AuthenticatedRequest): { userId: string; sessionId: string } {
    if (!request.auth) {
      throw new Error('Authenticated request missing auth payload');
    }

    return request.auth;
  }

  private sessionToken(request: Request): string | undefined {
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (bearer) {
      return bearer;
    }

    return this.parseCookies(request.headers.cookie)[AUTH_COOKIE_NAMES.session];
  }

  private sessionClientContext(request: Request): SessionClientContext {
    const userAgent = request.headers['user-agent'];
    const ipAddress = request.ip;

    return {
      ...(userAgent ? { userAgent } : {}),
      ...(ipAddress ? { ipAddress } : {}),
    };
  }

  private setAuthCookies(
    response: Response,
    input: { sessionToken: string; sessionExpiresAt: Date },
  ): void {
    response.cookie(AUTH_COOKIE_NAMES.session, input.sessionToken, {
      ...this.cookieOptions,
      expires: input.sessionExpiresAt,
    });
  }

  private clearAuthCookies(response: Response): void {
    response.clearCookie(AUTH_COOKIE_NAMES.session, this.cookieOptions);
    // Cookies from the previous access/refresh scheme, cleared so a stale pair cannot linger.
    response.clearCookie(AUTH_COOKIE_NAMES.access, this.cookieOptions);
    response.clearCookie(AUTH_COOKIE_NAMES.refresh, this.cookieOptions);
  }

  private clearTelegramCookies(response: Response): void {
    response.clearCookie(TELEGRAM_STATE_COOKIE, this.telegramCookieOptions);
    response.clearCookie(TELEGRAM_VERIFIER_COOKIE, this.telegramCookieOptions);
    response.clearCookie(TELEGRAM_NONCE_COOKIE, this.telegramCookieOptions);
    response.clearCookie(TELEGRAM_REDIRECT_COOKIE, this.telegramCookieOptions);
  }

  private loginUrl(error: string): string {
    const url = new URL('/login', this.webAppUrl);
    url.searchParams.set('error', error);

    return url.toString();
  }

  private parseCookies(cookieHeader?: string): Record<string, string> {
    if (!cookieHeader) {
      return {};
    }

    const cookies: Record<string, string> = {};
    for (const cookie of cookieHeader.split(';')) {
      const [name, ...value] = cookie.trim().split('=');
      if (!name) {
        continue;
      }

      cookies[name] = decodeURIComponent(value.join('='));
    }

    return cookies;
  }

  private get cookieOptions(): CookieOptions {
    return sessionCookieOptions(this.config);
  }

  private get telegramCookieOptions(): CookieOptions {
    return {
      ...this.cookieOptions,
      maxAge: 10 * 60 * 1000,
    };
  }

  private get webAppUrl(): string {
    return this.config.getOrThrow<string>('WEB_APP_URL');
  }
}
