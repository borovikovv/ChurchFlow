import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { CalendarEventsController } from './calendar-events.controller';
import { CalendarEventsService } from './calendar-events.service';
import { CalendarEventsRepository } from './repositories/calendar-events.repository';

@Module({
  imports: [NotificationsModule],
  controllers: [CalendarEventsController],
  providers: [OrganizationAccessGuard, CalendarEventsService, CalendarEventsRepository],
})
export class CalendarEventsModule {}
