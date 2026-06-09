import { Module } from '@nestjs/common';
import { WebsitesController } from './websites.controller';
import { WebsitesRepository } from './repositories/websites.repository';
import { WebsitesService } from './websites.service';

@Module({
  controllers: [WebsitesController],
  providers: [WebsitesService, WebsitesRepository],
  exports: [WebsitesService]
})
export class WebsitesModule {}
