import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { ScheduledJobsModule } from '../scheduled-jobs/scheduled-jobs.module';
import { TelegramBotModule } from '../telegram-bot/telegram-bot.module';
import { BirthdayNotificationsScheduler } from './birthday-notifications.scheduler';
import { NotificationsRetentionScheduler } from './notifications-retention.scheduler';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './repositories/notifications.repository';

@Module({
  imports: [EmailModule, TelegramBotModule, ScheduledJobsModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    BirthdayNotificationsScheduler,
    NotificationsRetentionScheduler,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
