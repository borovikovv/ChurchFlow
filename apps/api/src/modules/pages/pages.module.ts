import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { PagesRepository } from './repositories/pages.repository';
import { PagesService } from './pages.service';

@Module({
  controllers: [PagesController],
  providers: [PagesService, PagesRepository]
})
export class PagesModule {}
