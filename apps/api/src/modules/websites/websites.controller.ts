import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ORG_PERMISSIONS } from '@churchflow/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  OrganizationAccessGuard,
  RequireOrganizationPermission,
} from '../../common/guards/organization-access.guard';
import { WebsitesService } from './websites.service';
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
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  @RequireOrganizationPermission(ORG_PERMISSIONS.websiteManage)
  async dashboardWebsite(@Param('organizationId') organizationId: string) {
    return this.websitesService.findByOrganizationId(organizationId);
  }

  @Patch('organizations/:organizationId/website')
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  @RequireOrganizationPermission(ORG_PERMISSIONS.websiteManage)
  async updateSettings(
    @Param('organizationId') organizationId: string,
    @Body() body: UpdateWebsiteSettingsDto,
  ) {
    return this.websitesService.updateSettings(organizationId, body);
  }

  @Post('organizations/:organizationId/website/publish')
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  @RequireOrganizationPermission(ORG_PERMISSIONS.websiteManage)
  async setPublished(
    @Param('organizationId') organizationId: string,
    @Body() body: PublishWebsiteDto,
  ) {
    return this.websitesService.setPublished(organizationId, body.published);
  }
}
