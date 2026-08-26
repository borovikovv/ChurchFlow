import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';
import { requestClientContext } from '../../../common/auth/request-client-context';
import { setSessionCookie } from '../../../common/auth/session-cookie';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../../../common/guards/session-auth.guard';
import { PasskeysService } from './passkeys.service';
import type { PasskeyRecord } from './passkeys.repository';
import {
  AuthenticatePasskeyDto,
  RegisterPasskeyDto,
  RenamePasskeyDto,
  toAuthenticationResponse,
  toRegistrationResponse,
} from './dto/passkey.dto';

// ThrottlerGuard is not registered globally, so the limits below only bind where the guard
// is actually applied.
@Controller('auth/passkeys')
@UseGuards(ThrottlerGuard)
export class PasskeysController {
  constructor(
    private readonly passkeysService: PasskeysService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(SessionAuthGuard)
  list(@Req() request: AuthenticatedRequest): Promise<PasskeyRecord[]> {
    return this.passkeysService.list(this.userId(request));
  }

  @Post('register/options')
  @UseGuards(SessionAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  startRegistration(
    @Req() request: AuthenticatedRequest,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    return this.passkeysService.startRegistration(this.userId(request));
  }

  @Post('register/verify')
  @UseGuards(SessionAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  finishRegistration(
    @Body() body: RegisterPasskeyDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PasskeyRecord> {
    return this.passkeysService.finishRegistration(
      this.userId(request),
      toRegistrationResponse(body.credential),
      body.label,
    );
  }

  @Patch(':passkeyId')
  @UseGuards(SessionAuthGuard)
  rename(
    @Param('passkeyId', ParseUUIDPipe) passkeyId: string,
    @Body() body: RenamePasskeyDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PasskeyRecord> {
    return this.passkeysService.rename(this.userId(request), passkeyId, body.label);
  }

  @Delete(':passkeyId')
  @UseGuards(SessionAuthGuard)
  remove(
    @Param('passkeyId', ParseUUIDPipe) passkeyId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ ok: true }> {
    return this.passkeysService.remove(this.userId(request), passkeyId);
  }

  @Post('login/options')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  startAuthentication(): Promise<PublicKeyCredentialRequestOptionsJSON> {
    return this.passkeysService.startAuthentication();
  }

  @Post('login/verify')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async finishAuthentication(
    @Body() body: AuthenticatePasskeyDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ redirectTo: string }> {
    const result = await this.passkeysService.finishAuthentication({
      response: toAuthenticationResponse(body.credential),
      ...(body.redirectTo ? { redirectTo: body.redirectTo } : {}),
      client: requestClientContext(request),
    });
    setSessionCookie(response, this.config, result);

    return { redirectTo: result.redirectTo };
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.auth) {
      throw new Error('Authenticated request missing auth payload');
    }

    return request.auth.userId;
  }
}
