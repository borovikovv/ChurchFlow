import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ENTITLEMENTS, googleAnalyticsResourceIdSchema } from '@churchflow/shared';
import { sessionCookieOptions } from '../../common/auth/session-cookie';
import { parseCookies } from '../../common/auth/session-token';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../../common/guards/session-auth.guard';
import {
  OrganizationAccessGuard,
  RequireOrganizationOwner,
} from '../../common/guards/organization-access.guard';
import {
  RequireEntitlement,
  SubscriptionEntitlementGuard,
} from '../../common/guards/subscription-entitlement.guard';
import { SelectWebsiteAnalyticsPropertyDto } from './dto/select-website-analytics-property.dto';
import { SetWebsiteAnalyticsMeasurementIdDto } from './dto/set-website-analytics-measurement-id.dto';
import { WebsiteAnalyticsReportQueryDto } from './dto/website-analytics-report-query.dto';
import {
  decodeGoogleOAuthFlow,
  encodeGoogleOAuthFlow,
  GOOGLE_OAUTH_FLOW_COOKIE,
  GOOGLE_OAUTH_FLOW_MAX_AGE_MS,
} from './google/google-oauth-flow-cookie';
import { websiteAnalyticsReturnUrl } from './website-analytics-return-url';
import { WebsiteAnalyticsService, type GoogleOAuthCompletion } from './website-analytics.service';

@Controller('organizations/:organizationId/website/analytics')
@UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
@RequireOrganizationOwner()
export class WebsiteAnalyticsController {
  constructor(
    private readonly websiteAnalyticsService: WebsiteAnalyticsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async status(@Param('organizationId') organizationId: string) {
    return this.websiteAnalyticsService.getStatus(organizationId);
  }

  /**
   * Opened by the browser as a top-level navigation, so failures that the owner can act on come
   * back to the analytics page instead of as a JSON body.
   */
  @Get('google/connect')
  @RequireEntitlement(ENTITLEMENTS.websiteWrite)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  connectGoogle(@Param('organizationId') organizationId: string, @Res() response: Response): void {
    const webAppUrl = this.config.getOrThrow<string>('WEB_APP_URL');
    if (!this.websiteAnalyticsService.oauthAvailable) {
      response.redirect(
        websiteAnalyticsReturnUrl(webAppUrl, organizationId, {
          ok: false,
          reason: 'unavailable',
        }),
      );
      return;
    }

    const { authorizationUrl, flow } = this.websiteAnalyticsService.beginOAuth(organizationId);
    response.cookie(GOOGLE_OAUTH_FLOW_COOKIE, encodeGoogleOAuthFlow(flow), {
      ...sessionCookieOptions(this.config),
      maxAge: GOOGLE_OAUTH_FLOW_MAX_AGE_MS,
    });
    response.redirect(authorizationUrl);
  }

  /** The second half of the Google callback, once the organization is known. */
  @Get('google/complete')
  @RequireEntitlement(ENTITLEMENTS.websiteWrite)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async completeGoogle(
    @Param('organizationId') organizationId: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    const flow = decodeGoogleOAuthFlow(
      parseCookies(request.headers.cookie)[GOOGLE_OAUTH_FLOW_COOKIE],
    );
    response.clearCookie(GOOGLE_OAUTH_FLOW_COOKIE, sessionCookieOptions(this.config));

    const completion: GoogleOAuthCompletion =
      flow?.organizationId === organizationId
        ? await this.websiteAnalyticsService.completeOAuth({
            actorUserId: actorUserId(request),
            flow,
            code,
            state,
            error,
          })
        : { ok: false, reason: 'expired' };
    response.redirect(
      websiteAnalyticsReturnUrl(
        this.config.getOrThrow<string>('WEB_APP_URL'),
        organizationId,
        completion,
      ),
    );
  }

  @Get('google/properties')
  async properties(@Param('organizationId') organizationId: string) {
    return this.websiteAnalyticsService.listProperties(organizationId);
  }

  @Get('google/properties/:propertyId/data-streams')
  async dataStreams(
    @Param('organizationId') organizationId: string,
    @Param('propertyId') propertyId: string,
  ) {
    if (!googleAnalyticsResourceIdSchema.safeParse(propertyId).success) {
      throw new BadRequestException('Invalid Google Analytics property id');
    }

    return this.websiteAnalyticsService.listDataStreams(organizationId, propertyId);
  }

  @Put('property')
  @RequireEntitlement(ENTITLEMENTS.websiteWrite)
  async selectProperty(
    @Param('organizationId') organizationId: string,
    @Body() body: SelectWebsiteAnalyticsPropertyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.websiteAnalyticsService.selectProperty(organizationId, actorUserId(request), body);
  }

  @Put('measurement-id')
  @RequireEntitlement(ENTITLEMENTS.websiteWrite)
  async setMeasurementId(
    @Param('organizationId') organizationId: string,
    @Body() body: SetWebsiteAnalyticsMeasurementIdDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.websiteAnalyticsService.setManualMeasurementId(
      organizationId,
      actorUserId(request),
      body.measurementId,
    );
  }

  // Removing tracking stays possible without an active subscription, like unpublishing would.
  @Delete()
  async disconnect(
    @Param('organizationId') organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.websiteAnalyticsService.disconnect(organizationId, actorUserId(request));
  }

  @Get('report')
  async report(
    @Param('organizationId') organizationId: string,
    @Query() query: WebsiteAnalyticsReportQueryDto,
  ) {
    return this.websiteAnalyticsService.getReport(organizationId, query.range);
  }
}

function actorUserId(request: AuthenticatedRequest): string {
  const userId = request.auth?.userId;
  if (!userId) {
    throw new Error('Authenticated request missing auth payload');
  }

  return userId;
}
