import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { CurrencyRatesModule } from '../currency-rates/currency-rates.module';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { BudgetsRepository } from './repositories/budgets.repository';

@Module({
  imports: [CurrencyRatesModule],
  controllers: [BudgetsController],
  providers: [OrganizationAccessGuard, BudgetsService, BudgetsRepository],
})
export class BudgetsModule {}
