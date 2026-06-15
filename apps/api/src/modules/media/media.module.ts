import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { MediaController } from './media.controller';
import { MediaRepository } from './repositories/media.repository';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController],
  providers: [OrganizationAccessGuard, MediaService, MediaRepository]
})
export class MediaModule {}
