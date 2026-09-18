import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { MediaModule } from '../media/media.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { GroupsRepository } from './repositories/groups.repository';

@Module({
  imports: [MediaModule],
  controllers: [GroupsController],
  providers: [OrganizationAccessGuard, GroupsService, GroupsRepository],
})
export class GroupsModule {}
