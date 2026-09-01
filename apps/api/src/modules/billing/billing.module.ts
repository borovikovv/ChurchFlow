import { Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';
import { SubscriptionsRepository } from './repositories/subscriptions.repository';

@Module({
  providers: [EntitlementsService, SubscriptionsRepository],
  exports: [EntitlementsService],
})
export class BillingModule {}
