import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PagesService } from './pages.service';

@Controller()
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get('public/o/:orgSlug/pages/:pageSlug')
  async publicPage(@Param('orgSlug') orgSlug: string, @Param('pageSlug') pageSlug: string) {
    return this.pagesService.findPublicPage(orgSlug, pageSlug);
  }

  @Get('organizations/:organizationId/pages')
  @UseGuards(JwtAuthGuard)
  async dashboardPages(@Param('organizationId') organizationId: string) {
    return this.pagesService.listDashboardPages(organizationId);
  }
}
