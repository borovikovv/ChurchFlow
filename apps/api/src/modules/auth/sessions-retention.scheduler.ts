import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ScheduledJobLockService } from '../scheduled-jobs/scheduled-job-lock.service';
import { AuthService } from './auth.service';
import { resolveSessionRetentionCutoff } from './session-retention';

const SESSIONS_RETENTION_JOB = 'sessions.retention';
const SESSIONS_RETENTION_LOCK_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class SessionsRetentionScheduler {
  private readonly logger = new Logger(SessionsRetentionScheduler.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly scheduledJobLockService: ScheduledJobLockService,
  ) {}

  @Cron('0 45 3 * * *', {
    name: SESSIONS_RETENTION_JOB,
    timeZone: 'Europe/Kyiv',
    waitForCompletion: true,
  })
  async handleRetention() {
    const cutoff = resolveSessionRetentionCutoff(
      new Date(),
      this.configService.getOrThrow<number>('SESSIONS_RETENTION_DAYS'),
    );
    const dryRun = this.configService.getOrThrow<boolean>('SESSIONS_RETENTION_DRY_RUN');

    const execution = await this.scheduledJobLockService.runOnce(
      SESSIONS_RETENTION_JOB,
      () => this.authService.purgeExpiredSessions({ cutoff, dryRun }),
      { lockTtlMs: SESSIONS_RETENTION_LOCK_TTL_MS },
    );

    if (execution.skipped) return;

    this.logger.log({
      event: 'Session retention scheduled job completed',
      cutoff: cutoff.toISOString(),
      dryRun,
      result: execution.result,
    });
  }
}
