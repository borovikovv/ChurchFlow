import { Body, Controller, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ENTITLEMENTS } from '@churchflow/shared';
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
import { PUBLIC_WEBSITE_MEDIA_HEADERS, PUBLIC_WEBSITE_MEDIA_PATH } from '../media/public-media-url';
import { WebsitesService } from './websites.service';
import { ApplyWebsiteTemplateDto } from './dto/apply-website-template.dto';
import { PublishWebsiteDto } from './dto/publish-website.dto';
import { UpdateWebsiteSettingsDto } from './dto/update-website-settings.dto';

@Controller()
export class WebsitesController {
  constructor(private readonly websitesService: WebsitesService) {}

  @Get('public/o/:orgSlug')
  async publicWebsite(@Param('orgSlug') orgSlug: string) {
    return this.websitesService.findPublicWebsite(orgSlug);
  }

  /**
   * An image a published website references, as a temporary redirect to a signature minted for
   * this request. Unguarded on purpose, like the payload that links to it: browsers, crawlers and
   * social unfurlers fetch these urls with no session, minutes to months after the page was
   * rendered, and a session would make the response depend on who asked. Nothing here reads the
   * request beyond the id in the path, no cookie is consulted, and no bytes pass through the API.
   *
   * 302 rather than 301 or 308: a permanent redirect is cached indefinitely by browsers, proxies
   * and image crawlers, which would pin a url that stops working in five minutes. 307 would do as
   * well but buys nothing for a GET, and 302 is what every unfurler handles.
   */
  @Get(`${PUBLIC_WEBSITE_MEDIA_PATH}/:assetId`)
  async publicWebsiteMedia(
    @Param('assetId') assetId: string,
    @Res() response: Response,
  ): Promise<void> {
    const url = await this.websitesService.findPublicWebsiteMediaUrl(assetId);

    for (const [header, value] of Object.entries(PUBLIC_WEBSITE_MEDIA_HEADERS)) {
      response.setHeader(header, value);
    }
    response.redirect(302, url);
  }

  @Get('organizations/:organizationId/website')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireOrganizationOwner()
  async dashboardWebsite(@Param('organizationId') organizationId: string) {
    return this.websitesService.findByOrganizationId(organizationId);
  }

  @Patch('organizations/:organizationId/website')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireOrganizationOwner()
  @RequireEntitlement(ENTITLEMENTS.websiteWrite)
  async updateSettings(
    @Param('organizationId') organizationId: string,
    @Body() body: UpdateWebsiteSettingsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.websitesService.updateSettings(organizationId, this.actorUserId(request), body);
  }

  @Post('organizations/:organizationId/website/publish')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireOrganizationOwner()
  @RequireEntitlement(ENTITLEMENTS.websiteWrite)
  async setPublished(
    @Param('organizationId') organizationId: string,
    @Body() body: PublishWebsiteDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.websitesService.setPublished(
      organizationId,
      this.actorUserId(request),
      body.published,
    );
  }

  @Post('organizations/:organizationId/website/template')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireOrganizationOwner()
  @RequireEntitlement(ENTITLEMENTS.websiteWrite)
  async applyTemplate(
    @Param('organizationId') organizationId: string,
    @Body() body: ApplyWebsiteTemplateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.websitesService.applyTemplate(organizationId, this.actorUserId(request), body);
  }

  private actorUserId(request: AuthenticatedRequest): string {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new Error('Authenticated request missing auth payload');
    }

    return userId;
  }
}
