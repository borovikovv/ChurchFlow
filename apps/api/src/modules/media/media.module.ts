import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { SubscriptionEntitlementGuard } from '../../common/guards/subscription-entitlement.guard';
import { BillingModule } from '../billing/billing.module';
import { MediaController } from './media.controller';
import { MediaRepository } from './repositories/media.repository';
import { MediaService } from './media.service';

@Module({
  imports: [BillingModule],
  controllers: [MediaController],
  providers: [OrganizationAccessGuard, SubscriptionEntitlementGuard, MediaService, MediaRepository],
  exports: [MediaService],
})
export class MediaModule {}
