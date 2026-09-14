import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { SubscriptionEntitlementGuard } from '../../common/guards/subscription-entitlement.guard';
import { CurrencyRatesModule } from '../currency-rates/currency-rates.module';
import { BillingModule } from '../billing/billing.module';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { BudgetsRepository } from './repositories/budgets.repository';

@Module({
  imports: [CurrencyRatesModule, BillingModule],
  controllers: [BudgetsController],
  providers: [
    OrganizationAccessGuard,
    SubscriptionEntitlementGuard,
    BudgetsService,
    BudgetsRepository,
  ],
})
export class BudgetsModule {}
