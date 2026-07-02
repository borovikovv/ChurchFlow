import {
  Body,
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AUTH_COOKIE_NAMES } from '@churchflow/shared';
import type { CookieOptions, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { ProviderLoginDto, providerLoginSchema } from './dto/provider-login.dto';
import { JwtAuthGuard, type AuthenticatedRequest } from '../../common/guards/jwt-auth.guard';

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

interface RefreshAccessTokenResult {
  accessToken: string;
  accessTokenExpiresAt: Date;
  user: AuthUserResult;
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
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  redirectTo: string;
}

interface ProviderLoginRequest {
  provider: 'telegram';
  providerToken: string;
  redirectTo?: string;
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
  }): Promise<CompleteTelegramLoginResult>;
  refreshAccessToken(refreshToken: string): Promise<RefreshAccessTokenResult>;
  logout(sessionId: string): Promise<{ ok: true }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAuthUserResult(value: unknown): value is RefreshAccessTokenResult['user'] {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    (typeof value['email'] === 'string' || value['email'] === null) &&
    (typeof value['displayName'] === 'string' || value['displayName'] === null) &&
    typeof value['platformRole'] === 'string'
  );
}

function isRefreshAccessTokenResult(value: unknown): value is RefreshAccessTokenResult {
  return (
    isRecord(value) &&
    typeof value['accessToken'] === 'string' &&
    value['accessTokenExpiresAt'] instanceof Date &&
    isAuthUserResult(value['user'])
  );
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
      });
      this.setAuthCookies(response, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        refreshTokenExpiresAt: result.refreshTokenExpiresAt,
      });
      response.redirect(new URL(result.redirectTo, this.webAppUrl).toString());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Telegram login failed';
      response.redirect(this.loginUrl(message));
    }
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshAccessTokenResult> {
    const refreshToken = this.parseCookies(request.headers.cookie)[AUTH_COOKIE_NAMES.refresh];
    if (!refreshToken) {
      this.clearAuthCookies(response);
      throw new UnauthorizedException('Missing refresh token');
    }

    try {
      const serviceResult = (await this.authService.refreshAccessToken(refreshToken)) as unknown;
      if (!isRefreshAccessTokenResult(serviceResult)) {
        throw new InternalServerErrorException('Invalid refresh response');
      }

      const result: RefreshAccessTokenResult = serviceResult;
      response.cookie(AUTH_COOKIE_NAMES.access, result.accessToken, {
        ...this.cookieOptions,
        expires: result.accessTokenExpiresAt,
      });

      return result;
    } catch (caught: unknown) {
      if (caught instanceof UnauthorizedException) {
        this.clearAuthCookies(response);
      }
      throw caught;
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: true }> {
    if (request.auth) {
      await this.authService.logout(request.auth.sid);
    }
    this.clearAuthCookies(response);
    return { ok: true };
  }

  private setAuthCookies(
    response: Response,
    input: {
      accessToken: string;
      refreshToken: string;
      accessTokenExpiresAt: Date;
      refreshTokenExpiresAt: Date;
    },
  ): void {
    response.cookie(AUTH_COOKIE_NAMES.access, input.accessToken, {
      ...this.cookieOptions,
      expires: input.accessTokenExpiresAt,
    });
    response.cookie(AUTH_COOKIE_NAMES.refresh, input.refreshToken, {
      ...this.cookieOptions,
      expires: input.refreshTokenExpiresAt,
    });
  }

  private clearAuthCookies(response: Response): void {
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
    const domain = this.config.get<string>('COOKIE_DOMAIN');
    const isHttpsApp = this.webAppUrl.startsWith('https://');

    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: isHttpsApp || this.config.get<string>('NODE_ENV') === 'production',
      path: '/',
      ...(domain ? { domain } : {}),
    };
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
