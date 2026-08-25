import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduledJobLockService } from '../scheduled-jobs/scheduled-job-lock.service';
import { CurrencyRatesService } from './currency-rates.service';

const CURRENCY_RATES_SNAPSHOT_JOB = 'currency-rates.snapshot';
const CURRENCY_RATES_SNAPSHOT_LOCK_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class CurrencyRatesScheduler {
  private readonly logger = new Logger(CurrencyRatesScheduler.name);

  constructor(
    private readonly currencyRatesService: CurrencyRatesService,
    private readonly scheduledJobLockService: ScheduledJobLockService,
  ) {}

  // Budget totals price past months at the rate of their last day, so the daily rate has to be
  // stored as it is published rather than only when somebody happens to open the budget.
  @Cron('0 0 10 * * *', {
    name: CURRENCY_RATES_SNAPSHOT_JOB,
    timeZone: 'Europe/Kyiv',
    waitForCompletion: true,
  })
  async handleSnapshot() {
    const execution = await this.scheduledJobLockService.runOnce(
      CURRENCY_RATES_SNAPSHOT_JOB,
      () => this.currencyRatesService.getCurrent(),
      { lockTtlMs: CURRENCY_RATES_SNAPSHOT_LOCK_TTL_MS },
    );

    if (execution.skipped) return;

    if (!execution.result) {
      this.logger.warn({ event: 'Currency rate snapshot found no rate to store' });
      return;
    }

    this.logger.log({ event: 'Currency rate snapshot stored', date: execution.result.date });
  }
}
