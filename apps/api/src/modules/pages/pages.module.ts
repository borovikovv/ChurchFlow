import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { PagesController } from './pages.controller';
import { PagesRepository } from './repositories/pages.repository';
import { PagesService } from './pages.service';

@Module({
  controllers: [PagesController],
  providers: [OrganizationAccessGuard, PagesService, PagesRepository]
})
export class PagesModule {}
