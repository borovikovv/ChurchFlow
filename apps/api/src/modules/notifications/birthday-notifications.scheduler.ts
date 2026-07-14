import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduledJobLockService } from '../scheduled-jobs/scheduled-job-lock.service';
import { NotificationsService } from './notifications.service';

const BIRTHDAY_DIGEST_JOB = 'notifications.birthday-digest';
const BIRTHDAY_DIGEST_LOCK_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class BirthdayNotificationsScheduler {
  private readonly logger = new Logger(BirthdayNotificationsScheduler.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly scheduledJobLockService: ScheduledJobLockService,
  ) {}

  @Cron('0 0 9 * * *', {
    name: BIRTHDAY_DIGEST_JOB,
    timeZone: 'Europe/Kyiv',
    waitForCompletion: true,
  })
  async handleBirthdayDigest() {
    const execution = await this.scheduledJobLockService.runOnce(
      BIRTHDAY_DIGEST_JOB,
      () => this.notificationsService.createBirthdayDigestNotifications(new Date()),
      { lockTtlMs: BIRTHDAY_DIGEST_LOCK_TTL_MS },
    );

    if (execution.skipped) return;

    this.logger.log({
      event: 'Birthday digest scheduled job completed',
      result: execution.result,
    });
  }
}
