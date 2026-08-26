import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { requestClientContext } from '../../../common/auth/request-client-context';
import { setSessionCookie } from '../../../common/auth/session-cookie';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../../../common/guards/session-auth.guard';
import { EmailAuthService } from './email-auth.service';
import { EmailSignInCodeDto, EmailSignInRequestDto } from './dto/email-sign-in.dto';

@Controller('auth/email')
export class EmailAuthController {
  constructor(
    private readonly emailAuthService: EmailAuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('request')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async requestSignIn(
    @Body() body: EmailSignInRequestDto,
    @Req() request: Request,
  ): Promise<{ ok: true }> {
    const acceptLanguage = request.headers['accept-language'];

    await this.emailAuthService.requestSignIn({
      email: body.email,
      ...(body.redirectTo ? { redirectTo: body.redirectTo } : {}),
      ...(acceptLanguage ? { acceptLanguage } : {}),
      client: requestClientContext(request),
    });

    return { ok: true };
  }

  @Get('callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async completeSignIn(
    @Query('token') token: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (!token) {
      response.redirect(this.errorUrl('/login', 'This sign-in link is no longer valid'));
      return;
    }

    try {
      const result = await this.emailAuthService.completeSignInWithToken(
        token,
        requestClientContext(request),
      );
      setSessionCookie(response, this.config, result);
      response.redirect(new URL(result.redirectTo, this.webAppUrl).toString());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Email sign-in failed';
      response.redirect(this.errorUrl('/login', message));
    }
  }

  @Post('code')
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  async completeSignInWithCode(
    @Body() body: EmailSignInCodeDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ redirectTo: string }> {
    const result = await this.emailAuthService.completeSignInWithCode(
      { email: body.email, code: body.code },
      requestClientContext(request),
    );
    setSessionCookie(response, this.config, result);

    return { redirectTo: result.redirectTo };
  }

  @Post('verify/request')
  @UseGuards(SessionAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  requestVerification(@Req() request: AuthenticatedRequest): Promise<{ ok: true }> {
    if (!request.auth) {
      throw new Error('Authenticated request missing auth payload');
    }

    return this.emailAuthService.requestEmailVerification(
      request.auth.userId,
      requestClientContext(request),
    );
  }

  @Get('verify')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async completeVerification(
    @Query('token') token: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (!token) {
      response.redirect(this.errorUrl('/profile', 'This verification link is no longer valid'));
      return;
    }

    try {
      const result = await this.emailAuthService.completeEmailVerification(token);
      response.redirect(new URL(result.redirectTo, this.webAppUrl).toString());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Email verification failed';
      response.redirect(this.errorUrl('/profile', message));
    }
  }

  private errorUrl(path: string, error: string): string {
    const url = new URL(path, this.webAppUrl);
    url.searchParams.set('error', error);

    return url.toString();
  }

  private get webAppUrl(): string {
    return this.config.getOrThrow<string>('WEB_APP_URL');
  }
}
