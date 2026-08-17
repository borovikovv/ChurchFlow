import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrayerRequestsController } from './prayer-requests.controller';
import { PrayerRequestsService } from './prayer-requests.service';
import { PrayerRequestsRepository } from './repositories/prayer-requests.repository';

@Module({
  imports: [NotificationsModule],
  controllers: [PrayerRequestsController],
  providers: [OrganizationAccessGuard, PrayerRequestsService, PrayerRequestsRepository],
})
export class PrayerRequestsModule {}
