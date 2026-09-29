import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { SubscriptionEntitlementGuard } from '../../common/guards/subscription-entitlement.guard';
import { BillingModule } from '../billing/billing.module';
import { GoogleAnalyticsCallbackController } from './google-analytics-callback.controller';
import { GoogleAnalyticsClient } from './google/google-analytics.client';
import { WebsiteAnalyticsRepository } from './repositories/website-analytics.repository';
import { WebsiteAnalyticsController } from './website-analytics.controller';
import { WebsiteAnalyticsService } from './website-analytics.service';

@Module({
  imports: [BillingModule],
  controllers: [WebsiteAnalyticsController, GoogleAnalyticsCallbackController],
  providers: [
    OrganizationAccessGuard,
    SubscriptionEntitlementGuard,
    GoogleAnalyticsClient,
    WebsiteAnalyticsRepository,
    WebsiteAnalyticsService,
  ],
})
export class WebsiteAnalyticsModule {}
