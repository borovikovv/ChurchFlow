import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ENTITLEMENTS } from '@churchflow/shared';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import {
  OrganizationAccessGuard,
  RequireOrganizationOwner,
} from '../../common/guards/organization-access.guard';
import {
  RequireEntitlement,
  SubscriptionEntitlementGuard,
} from '../../common/guards/subscription-entitlement.guard';
import { PagesService } from './pages.service';
import { PublishPageDto } from './dto/publish-page.dto';
import { ReorderSectionsDto } from './dto/reorder-sections.dto';
import { UpsertPageDto } from './dto/upsert-page.dto';
import { UpsertSectionDto } from './dto/upsert-section.dto';

@Controller()
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get('public/o/:orgSlug/pages/:pageSlug')
  async publicPage(@Param('orgSlug') orgSlug: string, @Param('pageSlug') pageSlug: string) {
    return this.pagesService.findPublicPage(orgSlug, pageSlug);
  }

  @Get('public/pages')
  async publicPagesForSitemap() {
    return this.pagesService.listPublicPagesForSitemap();
  }

  @Get('organizations/:organizationId/pages')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireOrganizationOwner()
  async dashboardPages(@Param('organizationId') organizationId: string) {
    return this.pagesService.listDashboardPages(organizationId);
  }

  @Get('organizations/:organizationId/pages/:pageId')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireOrganizationOwner()
  async dashboardPage(
    @Param('organizationId') organizationId: string,
    @Param('pageId') pageId: string,
  ) {
    return this.pagesService.findDashboardPage(organizationId, pageId);
  }

  @Post('organizations/:organizationId/pages')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireOrganizationOwner()
  @RequireEntitlement(ENTITLEMENTS.websiteWrite)
  async createPage(@Param('organizationId') organizationId: string, @Body() body: UpsertPageDto) {
    return this.pagesService.createPage(organizationId, body);
  }

  @Patch('organizations/:organizationId/pages/:pageId')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireOrganizationOwner()
  @RequireEntitlement(ENTITLEMENTS.websiteWrite)
  async updatePage(
    @Param('organizationId') organizationId: string,
    @Param('pageId') pageId: string,
    @Body() body: UpsertPageDto,
  ) {
    return this.pagesService.updatePage(organizationId, pageId, body);
  }

  @Post('organizations/:organizationId/pages/:pageId/publish')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireOrganizationOwner()
  @RequireEntitlement(ENTITLEMENTS.websiteWrite)
  async setPagePublished(
    @Param('organizationId') organizationId: string,
    @Param('pageId') pageId: string,
    @Body() body: PublishPageDto,
  ) {
    return this.pagesService.setPagePublished(organizationId, pageId, body.published);
  }

  @Post('organizations/:organizationId/pages/:pageId/sections')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireOrganizationOwner()
  @RequireEntitlement(ENTITLEMENTS.websiteWrite)
  async createSection(
    @Param('organizationId') organizationId: string,
    @Param('pageId') pageId: string,
    @Body() body: UpsertSectionDto,
  ) {
    return this.pagesService.createSection(organizationId, pageId, body);
  }

  @Patch('organizations/:organizationId/sections/:sectionId')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireOrganizationOwner()
  @RequireEntitlement(ENTITLEMENTS.websiteWrite)
  async updateSection(
    @Param('organizationId') organizationId: string,
    @Param('sectionId') sectionId: string,
    @Body() body: UpsertSectionDto,
  ) {
    return this.pagesService.updateSection(organizationId, sectionId, body);
  }

  @Delete('organizations/:organizationId/sections/:sectionId')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireOrganizationOwner()
  @RequireEntitlement(ENTITLEMENTS.websiteWrite)
  async deleteSection(
    @Param('organizationId') organizationId: string,
    @Param('sectionId') sectionId: string,
  ) {
    return this.pagesService.deleteSection(organizationId, sectionId);
  }

  @Post('organizations/:organizationId/pages/:pageId/sections/reorder')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireOrganizationOwner()
  @RequireEntitlement(ENTITLEMENTS.websiteWrite)
  async reorderSections(
    @Param('organizationId') organizationId: string,
    @Param('pageId') pageId: string,
    @Body() body: ReorderSectionsDto,
  ) {
    return this.pagesService.reorderSections(organizationId, pageId, body);
  }
}
