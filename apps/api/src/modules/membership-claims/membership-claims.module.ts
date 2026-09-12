import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { SubscriptionEntitlementGuard } from '../../common/guards/subscription-entitlement.guard';
import { BillingModule } from '../billing/billing.module';
import { MembershipClaimsController } from './membership-claims.controller';
import { MembershipClaimsService } from './membership-claims.service';
import { MembershipClaimsRepository } from './repositories/membership-claims.repository';

@Module({
  imports: [BillingModule],
  controllers: [MembershipClaimsController],
  providers: [
    MembershipClaimsService,
    MembershipClaimsRepository,
    OrganizationAccessGuard,
    SubscriptionEntitlementGuard,
  ],
  exports: [MembershipClaimsService, MembershipClaimsRepository],
})
export class MembershipClaimsModule {}
