import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { InvitationsModule } from '../invitations/invitations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MembershipsController } from './memberships.controller';
import { MembershipsRepository } from './repositories/memberships.repository';
import { MembershipsService } from './memberships.service';

@Module({
  imports: [InvitationsModule, NotificationsModule],
  controllers: [MembershipsController],
  providers: [OrganizationAccessGuard, MembershipsService, MembershipsRepository],
})
export class MembershipsModule {}
