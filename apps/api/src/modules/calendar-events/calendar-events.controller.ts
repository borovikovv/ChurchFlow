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
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../../common/guards/session-auth.guard';
import { ENTITLEMENTS } from '@churchflow/shared';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import {
  RequireEntitlement,
  SubscriptionEntitlementGuard,
} from '../../common/guards/subscription-entitlement.guard';
import { CalendarEventsService } from './calendar-events.service';
import {
  CreateCalendarEventDto,
  ListCalendarEventsQueryDto,
  ToggleCalendarTaskCompletionDto,
  UpdateCalendarEventDto,
  UpdateCalendarPreferencesDto,
} from './dto/calendar-event.dto';

@Controller('organizations/:organizationId/calendar-events')
@UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
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
  @RequireEntitlement(ENTITLEMENTS.calendarWrite)
  create(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateCalendarEventDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.calendarEventsService.create(organizationId, body, this.actorUserId(request));
  }

  @Patch(':eventId')
  @RequireEntitlement(ENTITLEMENTS.calendarWrite)
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
  @RequireEntitlement(ENTITLEMENTS.calendarWrite)
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
  @RequireEntitlement(ENTITLEMENTS.calendarWrite)
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
