import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { SubscriptionEntitlementGuard } from '../../common/guards/subscription-entitlement.guard';
import { BillingModule } from '../billing/billing.module';
import { MediaModule } from '../media/media.module';
import { WebsitesController } from './websites.controller';
import { WebsitesRepository } from './repositories/websites.repository';
import { WebsitesService } from './websites.service';

@Module({
  imports: [BillingModule, MediaModule],
  controllers: [WebsitesController],
  providers: [
    OrganizationAccessGuard,
    SubscriptionEntitlementGuard,
    WebsitesService,
    WebsitesRepository,
  ],
  exports: [WebsitesService],
})
export class WebsitesModule {}
