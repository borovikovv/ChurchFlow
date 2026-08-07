import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { InvitationsModule } from '../invitations/invitations.module';
import { TelegramBotModule } from '../telegram-bot/telegram-bot.module';
import { OrganizationRequestsController } from './organization-requests.controller';
import { OrganizationRequestsService } from './organization-requests.service';
import { OrganizationRequestsRepository } from './repositories/organization-requests.repository';

@Module({
  imports: [InvitationsModule, TelegramBotModule],
  controllers: [OrganizationRequestsController],
  providers: [OrganizationRequestsService, OrganizationRequestsRepository, PlatformAdminGuard],
  exports: [OrganizationRequestsRepository],
})
export class OrganizationRequestsModule {}
