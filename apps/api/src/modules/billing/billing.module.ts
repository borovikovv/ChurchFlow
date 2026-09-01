import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { CurrencyRatesModule } from '../currency-rates/currency-rates.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScheduledJobsModule } from '../scheduled-jobs/scheduled-jobs.module';
import { BillingController } from './billing.controller';
import { BillingDunningScheduler } from './billing-dunning.scheduler';
import { BillingService } from './billing.service';
import { EntitlementsService } from './entitlements.service';
import { LiqPayService } from './liqpay.service';
import { SubscriptionsRepository } from './repositories/subscriptions.repository';

@Module({
  imports: [CurrencyRatesModule, NotificationsModule, ScheduledJobsModule],
  controllers: [BillingController],
  providers: [
    OrganizationAccessGuard,
    EntitlementsService,
    BillingService,
    LiqPayService,
    SubscriptionsRepository,
    BillingDunningScheduler,
  ],
  exports: [EntitlementsService],
})
export class BillingModule {}
