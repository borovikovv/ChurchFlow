import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScheduledJobsModule } from '../scheduled-jobs/scheduled-jobs.module';
import { CalendarEventRemindersScheduler } from './calendar-event-reminders.scheduler';
import { CalendarEventsController } from './calendar-events.controller';
import { CalendarEventsService } from './calendar-events.service';
import { CalendarEventsRepository } from './repositories/calendar-events.repository';

@Module({
  imports: [NotificationsModule, ScheduledJobsModule],
  controllers: [CalendarEventsController],
  providers: [
    OrganizationAccessGuard,
    CalendarEventsService,
    CalendarEventsRepository,
    CalendarEventRemindersScheduler,
  ],
})
export class CalendarEventsModule {}
