import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { parseCookies } from '../../common/auth/session-token';
import { decodeGoogleOAuthFlow, GOOGLE_OAUTH_FLOW_COOKIE } from './google/google-oauth-flow-cookie';

/**
 * Where Google sends the owner back after consent. Google redirects to one registered url, so the
 * organization cannot be part of it; this hop reads the organization from the flow cookie and
 * forwards the answer to the organization's own completion route, where the session, owner and
 * entitlement guards apply exactly as on every other analytics route.
 */
@Controller('integrations/google-analytics')
export class GoogleAnalyticsCallbackController {
  constructor(private readonly config: ConfigService) {}

  @Get('callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): void {
    const flow = decodeGoogleOAuthFlow(
      parseCookies(request.headers.cookie)[GOOGLE_OAUTH_FLOW_COOKIE],
    );
    if (!flow) {
      response.redirect(
        new URL('/dashboard', this.config.getOrThrow<string>('WEB_APP_URL')).toString(),
      );
      return;
    }

    const query = new URLSearchParams();
    for (const [name, value] of Object.entries({ code, state, error })) {
      if (value) query.set(name, value);
    }
    // Relative to this route, so it keeps whatever prefix and host the request came through: the
    // browser reaches it via the web app's /v1 rewrite, where the flow cookie was set.
    response.redirect(
      `../../organizations/${encodeURIComponent(flow.organizationId)}/website/analytics/google/complete?${query.toString()}`,
    );
  }
}
