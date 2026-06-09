import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaRepository } from './repositories/media.repository';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, MediaRepository]
})
export class MediaModule {}
