import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { SubscriptionEntitlementGuard } from '../../common/guards/subscription-entitlement.guard';
import { MediaModule } from '../media/media.module';
import { BillingModule } from '../billing/billing.module';
import { PagesController } from './pages.controller';
import { PagesRepository } from './repositories/pages.repository';
import { PagesService } from './pages.service';

@Module({
  imports: [MediaModule, BillingModule],
  controllers: [PagesController],
  providers: [OrganizationAccessGuard, SubscriptionEntitlementGuard, PagesService, PagesRepository],
})
export class PagesModule {}
