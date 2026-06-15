import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ORG_PERMISSIONS } from '@churchflow/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  OrganizationAccessGuard,
  RequireOrganizationPermission,
} from '../../common/guards/organization-access.guard';
import { PagesService } from './pages.service';

@Controller()
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get('public/o/:orgSlug/pages/:pageSlug')
  async publicPage(@Param('orgSlug') orgSlug: string, @Param('pageSlug') pageSlug: string) {
    return this.pagesService.findPublicPage(orgSlug, pageSlug);
  }

  @Get('organizations/:organizationId/pages')
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  @RequireOrganizationPermission(ORG_PERMISSIONS.websiteManage)
  async dashboardPages(@Param('organizationId') organizationId: string) {
    return this.pagesService.listDashboardPages(organizationId);
  }
}
