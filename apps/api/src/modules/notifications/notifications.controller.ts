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
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import {
  ListNotificationsQueryDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';

@Controller('organizations/:organizationId/notifications')
@UseGuards(SessionAuthGuard, OrganizationAccessGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly telegramBotService: TelegramBotService,
  ) {}

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

  @Post('telegram/link-token')
  createTelegramLinkToken(@Req() request: AuthenticatedRequest) {
    return this.telegramBotService.createLinkToken(this.actorUserId(request));
  }

  @Delete('telegram/binding')
  disconnectTelegram(@Req() request: AuthenticatedRequest) {
    return this.telegramBotService.disconnectUser(this.actorUserId(request)).then((telegram) => ({
      telegram,
    }));
  }

  @Patch('read-all')
  markAllRead(
    @Param('organizationId') organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notificationsService.markAllRead(organizationId, this.actorUserId(request));
  }

  @Get(':notificationId')
  detail(
    @Param('organizationId') organizationId: string,
    @Param('notificationId') notificationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notificationsService.detailForOrganization(
      organizationId,
      notificationId,
      this.actorUserId(request),
    );
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
    const userId = request.auth?.userId;
    if (!userId) {
      throw new Error('Authenticated request missing auth payload');
    }

    return userId;
  }
}
