import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AI_ASSISTANT_MESSAGE_RETENTION_DAYS } from '@churchflow/shared';
import { ScheduledJobLockService } from '../scheduled-jobs/scheduled-job-lock.service';
import { AiAssistantRepository } from './repositories/ai-assistant.repository';

const AI_CONVERSATIONS_RETENTION_JOB = 'ai-assistant.conversations-retention';
const AI_CONVERSATIONS_RETENTION_LOCK_TTL_MS = 30 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function aiConversationRetentionCutoff(now: Date): Date {
  return new Date(now.getTime() - AI_ASSISTANT_MESSAGE_RETENTION_DAYS * MS_PER_DAY);
}

/**
 * Deletes conversations nobody has touched for the retention period, messages included. Whole
 * conversations go rather than old messages inside a live one: a history with its first half
 * missing can hold a confirmation without the call it confirms, which the model cannot replay.
 * Telemetry and tool executions keep their rows and lose only the link to the conversation.
 */
@Injectable()
export class AiConversationsRetentionScheduler {
  private readonly logger = new Logger(AiConversationsRetentionScheduler.name);

  constructor(
    private readonly repository: AiAssistantRepository,
    private readonly scheduledJobLockService: ScheduledJobLockService,
  ) {}

  @Cron('0 45 3 * * *', {
    name: AI_CONVERSATIONS_RETENTION_JOB,
    timeZone: 'Europe/Kyiv',
    waitForCompletion: true,
  })
  async handleRetention() {
    const execution = await this.scheduledJobLockService.runOnce(
      AI_CONVERSATIONS_RETENTION_JOB,
      () =>
        this.repository.purgeConversationsInactiveSince(aiConversationRetentionCutoff(new Date())),
      { lockTtlMs: AI_CONVERSATIONS_RETENTION_LOCK_TTL_MS },
    );

    if (execution.skipped) return;

    this.logger.log({
      event: 'AI conversations retention scheduled job completed',
      deletedConversations: execution.result,
    });
  }
}
