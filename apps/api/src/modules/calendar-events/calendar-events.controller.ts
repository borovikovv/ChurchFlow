import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard, type AuthenticatedRequest } from '../../common/guards/session-auth.guard';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { CalendarEventsService } from './calendar-events.service';
import {
  CreateCalendarEventDto,
  ListCalendarEventsQueryDto,
  ToggleCalendarTaskCompletionDto,
  UpdateCalendarEventDto,
  UpdateCalendarPreferencesDto,
} from './dto/calendar-event.dto';

@Controller('organizations/:organizationId/calendar-events')
@UseGuards(SessionAuthGuard, OrganizationAccessGuard)
export class CalendarEventsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  @Get()
  list(
    @Param('organizationId') organizationId: string,
    @Query() query: ListCalendarEventsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.calendarEventsService.listForOrganization(
      organizationId,
      this.actorUserId(request),
      query,
    );
  }

  @Patch('preferences')
  updatePreferences(
    @Param('organizationId') organizationId: string,
    @Body() body: UpdateCalendarPreferencesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.calendarEventsService.updatePreferences(
      organizationId,
      this.actorUserId(request),
      body.visibleEventTypes,
    );
  }

  @Post()
  create(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateCalendarEventDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.calendarEventsService.create(organizationId, body, this.actorUserId(request));
  }

  @Patch(':eventId')
  update(
    @Param('organizationId') organizationId: string,
    @Param('eventId') eventId: string,
    @Body() body: UpdateCalendarEventDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.calendarEventsService.update(
      organizationId,
      eventId,
      body,
      this.actorUserId(request),
    );
  }

  @Patch(':eventId/completion')
  toggleCompletion(
    @Param('organizationId') organizationId: string,
    @Param('eventId') eventId: string,
    @Body() body: ToggleCalendarTaskCompletionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.calendarEventsService.toggleTaskCompletion(
      organizationId,
      eventId,
      body.completed,
      this.actorUserId(request),
    );
  }

  @Delete(':eventId')
  delete(
    @Param('organizationId') organizationId: string,
    @Param('eventId') eventId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.calendarEventsService.delete(organizationId, eventId, this.actorUserId(request));
  }

  private actorUserId(request: AuthenticatedRequest): string {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new Error('Authenticated request missing auth payload');
    }

    return userId;
  }
}
