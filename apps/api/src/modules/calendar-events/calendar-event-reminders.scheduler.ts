import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduledJobLockService } from '../scheduled-jobs/scheduled-job-lock.service';
import { CalendarEventsService } from './calendar-events.service';

const CALENDAR_EVENT_REMINDERS_JOB = 'notifications.calendar-event-reminders';
const CALENDAR_EVENT_REMINDERS_LOCK_TTL_MS = 4 * 60 * 1000;

@Injectable()
export class CalendarEventRemindersScheduler {
  private readonly logger = new Logger(CalendarEventRemindersScheduler.name);

  constructor(
    private readonly calendarEventsService: CalendarEventsService,
    private readonly scheduledJobLockService: ScheduledJobLockService,
  ) {}

  @Cron('0 */5 * * * *', {
    name: CALENDAR_EVENT_REMINDERS_JOB,
    timeZone: 'Europe/Kyiv',
    waitForCompletion: true,
  })
  async handleCalendarEventReminders() {
    const execution = await this.scheduledJobLockService.runOnce(
      CALENDAR_EVENT_REMINDERS_JOB,
      () => this.calendarEventsService.createDueReminderNotifications(new Date()),
      { lockTtlMs: CALENDAR_EVENT_REMINDERS_LOCK_TTL_MS },
    );

    if (execution.skipped) return;

    this.logger.log({
      event: 'Calendar event reminders scheduled job completed',
      result: execution.result,
    });
  }
}
