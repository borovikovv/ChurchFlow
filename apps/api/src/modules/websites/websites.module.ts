import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { WebsitesController } from './websites.controller';
import { WebsitesRepository } from './repositories/websites.repository';
import { WebsitesService } from './websites.service';

@Module({
  controllers: [WebsitesController],
  providers: [OrganizationAccessGuard, WebsitesService, WebsitesRepository],
  exports: [WebsitesService]
})
export class WebsitesModule {}
