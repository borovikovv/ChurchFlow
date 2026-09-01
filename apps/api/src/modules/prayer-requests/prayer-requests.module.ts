import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { SubscriptionEntitlementGuard } from '../../common/guards/subscription-entitlement.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingModule } from '../billing/billing.module';
import { PrayerRequestsController } from './prayer-requests.controller';
import { PrayerRequestsService } from './prayer-requests.service';
import { PrayerRequestsRepository } from './repositories/prayer-requests.repository';

@Module({
  imports: [NotificationsModule, BillingModule],
  controllers: [PrayerRequestsController],
  providers: [
    OrganizationAccessGuard,
    SubscriptionEntitlementGuard,
    PrayerRequestsService,
    PrayerRequestsRepository,
  ],
})
export class PrayerRequestsModule {}
