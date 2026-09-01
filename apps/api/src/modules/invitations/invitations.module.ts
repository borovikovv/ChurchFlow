import { Module } from '@nestjs/common';
import { SubscriptionEntitlementGuard } from '../../common/guards/subscription-entitlement.guard';
import { BillingModule } from '../billing/billing.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { InvitationsRepository } from './repositories/invitations.repository';

@Module({
  imports: [BillingModule],
  controllers: [InvitationsController],
  providers: [SubscriptionEntitlementGuard, InvitationsService, InvitationsRepository],
  exports: [InvitationsService, InvitationsRepository],
})
export class InvitationsModule {}
