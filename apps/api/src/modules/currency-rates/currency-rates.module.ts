import { Module } from '@nestjs/common';
import { ScheduledJobsModule } from '../scheduled-jobs/scheduled-jobs.module';
import { CurrencyRatesScheduler } from './currency-rates.scheduler';
import { CurrencyRatesService } from './currency-rates.service';
import { CurrencyRatesRepository } from './repositories/currency-rates.repository';

@Module({
  imports: [ScheduledJobsModule],
  providers: [CurrencyRatesService, CurrencyRatesRepository, CurrencyRatesScheduler],
  exports: [CurrencyRatesService],
})
export class CurrencyRatesModule {}
