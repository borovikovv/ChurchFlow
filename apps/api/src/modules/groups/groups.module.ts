import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { GroupsRepository } from './repositories/groups.repository';

@Module({
  controllers: [GroupsController],
  providers: [OrganizationAccessGuard, GroupsService, GroupsRepository],
})
export class GroupsModule {}
