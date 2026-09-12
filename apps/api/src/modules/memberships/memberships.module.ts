import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { SubscriptionEntitlementGuard } from '../../common/guards/subscription-entitlement.guard';
import { InvitationsModule } from '../invitations/invitations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingModule } from '../billing/billing.module';
import { MembershipsController } from './memberships.controller';
import { MembershipsRepository } from './repositories/memberships.repository';
import { MembershipsService } from './memberships.service';

@Module({
  imports: [InvitationsModule, NotificationsModule, BillingModule],
  controllers: [MembershipsController],
  providers: [
    OrganizationAccessGuard,
    SubscriptionEntitlementGuard,
    MembershipsService,
    MembershipsRepository,
  ],
})
export class MembershipsModule {}
