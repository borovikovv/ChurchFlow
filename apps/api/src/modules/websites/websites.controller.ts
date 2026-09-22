import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
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
