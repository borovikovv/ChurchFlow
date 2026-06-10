import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { InvitationsModule } from '../invitations/invitations.module';
import { OrganizationRequestsController } from './organization-requests.controller';
import { OrganizationRequestsService } from './organization-requests.service';
import { OrganizationRequestsRepository } from './repositories/organization-requests.repository';

@Module({
  imports: [InvitationsModule],
  controllers: [OrganizationRequestsController],
  providers: [OrganizationRequestsService, OrganizationRequestsRepository, PlatformAdminGuard]
})
export class OrganizationRequestsModule {}
