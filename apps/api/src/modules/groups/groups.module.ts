import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { BillingModule } from '../billing/billing.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { GroupsRepository } from './repositories/groups.repository';

@Module({
  imports: [BillingModule],
  controllers: [GroupsController],
  providers: [OrganizationAccessGuard, GroupsService, GroupsRepository],
  exports: [GroupsService],
})
export class GroupsModule {}
