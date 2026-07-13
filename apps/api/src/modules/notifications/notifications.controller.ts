import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../../common/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import {
  ListNotificationsQueryDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('organizations/:organizationId/notifications')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @Param('organizationId') organizationId: string,
    @Query() query: ListNotificationsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notificationsService.listForOrganization(
      organizationId,
      this.actorUserId(request),
      query,
    );
  }

  @Get('summary')
  summary(@Param('organizationId') organizationId: string, @Req() request: AuthenticatedRequest) {
    return this.notificationsService.summaryForOrganization(
      organizationId,
      this.actorUserId(request),
    );
  }

  @Get('preferences')
  preferences(
    @Param('organizationId') organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notificationsService.preferencesForOrganization(
      organizationId,
      this.actorUserId(request),
    );
  }

  @Patch('preferences')
  updatePreferences(
    @Param('organizationId') organizationId: string,
    @Body() body: UpdateNotificationPreferencesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notificationsService.updatePreferences(
      organizationId,
      this.actorUserId(request),
      body,
    );
  }

  @Patch('read-all')
  markAllRead(
    @Param('organizationId') organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notificationsService.markAllRead(organizationId, this.actorUserId(request));
  }

  @Patch(':notificationId/read')
  markRead(
    @Param('organizationId') organizationId: string,
    @Param('notificationId') notificationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notificationsService.markRead(
      organizationId,
      notificationId,
      this.actorUserId(request),
    );
  }

  private actorUserId(request: AuthenticatedRequest): string {
    const userId = request.auth?.sub;
    if (!userId) {
      throw new Error('Authenticated request missing auth payload');
    }

    return userId;
  }
}
