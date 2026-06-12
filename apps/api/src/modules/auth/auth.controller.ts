import {
  Body,
  Controller,
  Inject,
  InternalServerErrorException,
  Post,
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
import { StartEmailLoginDto } from './dto/start-email-login.dto';
import { VerifyEmailLoginDto } from './dto/verify-email-login.dto';
import { JwtAuthGuard, type AuthenticatedRequest } from '../../common/guards/jwt-auth.guard';

interface AuthUserResult {
  id: string;
  email: string | null;
  displayName: string | null;
  platformRole: string;
}

interface VerifyEmailLoginResult {
  user: AuthUserResult;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  redirectTo: string;
}

interface RefreshAccessTokenResult {
  accessToken: string;
  accessTokenExpiresAt: Date;
  user: AuthUserResult;
}

interface StartEmailLoginResult {
  ok: true;
}

interface StartEmailLoginRequest {
  email: string;
  redirectTo?: string;
}

interface ProviderLoginRequest {
  provider: 'telegram' | 'webauthn' | 'email' | 'google' | 'apple';
  providerToken: string;
  redirectTo?: string;
}

interface AuthCookieInput {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

interface AuthControllerService {
  beginProviderLogin(input: ProviderLoginRequest): Promise<{ provider: string }>;
  startEmailLogin(input: StartEmailLoginRequest): Promise<StartEmailLoginResult>;
  verifyEmailLogin(input: VerifyEmailLoginDto): Promise<VerifyEmailLoginResult>;
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
  async providerLogin(@Body() body: ProviderLoginDto): Promise<{ provider: string }> {
    const parsed = providerLoginSchema.parse(body);
    const input: ProviderLoginRequest = {
      provider: parsed.provider,
      providerToken: parsed.providerToken,
      ...(parsed.redirectTo ? { redirectTo: parsed.redirectTo } : {}),
    };

    return this.authService.beginProviderLogin(input);
  }

  @Post('email/start')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async startEmailLogin(@Body() body: StartEmailLoginDto): Promise<StartEmailLoginResult> {
    const input: StartEmailLoginRequest = {
      email: body.email,
      ...(body.redirectTo ? { redirectTo: body.redirectTo } : {}),
    };
    const result: StartEmailLoginResult = await this.authService.startEmailLogin(input);

    return result;
  }

  @Post('email/verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyEmailLogin(
    @Body() body: VerifyEmailLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<VerifyEmailLoginResult> {
    const result: VerifyEmailLoginResult = await this.authService.verifyEmailLogin(body);
    this.setAuthCookies(response, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
      refreshTokenExpiresAt: result.refreshTokenExpiresAt,
    });

    return result;
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshAccessTokenResult> {
    const refreshToken = this.parseCookies(request.headers.cookie)[AUTH_COOKIE_NAMES.refresh];
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

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
    input: AuthCookieInput,
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

    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: '/',
      ...(domain ? { domain } : {}),
    };
  }
}
