import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ScheduledJobLockService } from '../scheduled-jobs/scheduled-job-lock.service';
import { resolveNotificationRetentionCutoffs } from './notification-retention';
import { NotificationsService } from './notifications.service';

const NOTIFICATIONS_RETENTION_JOB = 'notifications.retention';
const NOTIFICATIONS_RETENTION_LOCK_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class NotificationsRetentionScheduler {
  private readonly logger = new Logger(NotificationsRetentionScheduler.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly scheduledJobLockService: ScheduledJobLockService,
  ) {}

  @Cron('0 30 3 * * *', {
    name: NOTIFICATIONS_RETENTION_JOB,
    timeZone: 'Europe/Kyiv',
    waitForCompletion: true,
  })
  async handleRetention() {
    const cutoffs = resolveNotificationRetentionCutoffs(new Date(), {
      retentionDays: this.configService.getOrThrow<number>('NOTIFICATIONS_RETENTION_DAYS'),
      readRetentionDays: this.configService.getOrThrow<number>('NOTIFICATIONS_READ_RETENTION_DAYS'),
    });
    const dryRun = this.configService.getOrThrow<boolean>('NOTIFICATIONS_RETENTION_DRY_RUN');

    const execution = await this.scheduledJobLockService.runOnce(
      NOTIFICATIONS_RETENTION_JOB,
      () => this.notificationsService.purgeExpiredNotifications({ cutoffs, dryRun }),
      { lockTtlMs: NOTIFICATIONS_RETENTION_LOCK_TTL_MS },
    );

    if (execution.skipped) return;

    this.logger.log({
      event: 'Notification retention scheduled job completed',
      result: execution.result,
    });
  }
}
