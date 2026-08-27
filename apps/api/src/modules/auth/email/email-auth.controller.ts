import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
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

// Typed as a plain number so the comparison below is number-to-number: `getStatus()` returns
// a number, and comparing it straight against an enum member is flagged as unsafe.
const SERVER_ERROR_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;

@Controller('auth/email')
export class EmailAuthController {
  private readonly logger = new Logger(EmailAuthController.name);

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
        request.headers['accept-language'],
      );
      setSessionCookie(response, this.config, result);
      response.redirect(new URL(result.redirectTo, this.webAppUrl).toString());
    } catch (caught) {
      response.redirect(
        this.errorUrl('/login', this.visibleReason(caught, 'Email sign-in failed')),
      );
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
      request.headers['accept-language'],
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
      response.redirect(
        this.errorUrl('/profile', this.visibleReason(caught, 'Email verification failed')),
      );
    }
  }

  // These two endpoints answer with a redirect, so they never reach the exception filter that
  // replaces a server fault with a generic message. An unexpected error would otherwise put a
  // database or configuration message in the visitor's address bar.
  private visibleReason(caught: unknown, fallback: string): string {
    if (caught instanceof HttpException && caught.getStatus() < SERVER_ERROR_STATUS) {
      return caught.message;
    }

    this.logger.error(
      { event: 'Email auth redirect failed unexpectedly' },
      caught instanceof Error ? caught.stack : undefined,
    );

    return fallback;
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
