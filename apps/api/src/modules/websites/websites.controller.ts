import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ORG_PERMISSIONS } from '@churchflow/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  OrganizationAccessGuard,
  RequireOrganizationPermission,
} from '../../common/guards/organization-access.guard';
import { WebsitesService } from './websites.service';

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
}
