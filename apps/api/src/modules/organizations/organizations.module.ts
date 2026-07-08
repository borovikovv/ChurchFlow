import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { OrganizationRequestsModule } from '../organization-requests/organization-requests.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrganizationsRepository } from './repositories/organizations.repository';

@Module({
  imports: [OrganizationRequestsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationsRepository, PlatformAdminGuard],
  exports: [OrganizationsService]
})
export class OrganizationsModule {}
