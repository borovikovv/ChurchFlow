import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { MembershipClaimsController } from './membership-claims.controller';
import { MembershipClaimsService } from './membership-claims.service';
import { MembershipClaimsRepository } from './repositories/membership-claims.repository';

@Module({
  controllers: [MembershipClaimsController],
  providers: [MembershipClaimsService, MembershipClaimsRepository, OrganizationAccessGuard],
  exports: [MembershipClaimsService, MembershipClaimsRepository],
})
export class MembershipClaimsModule {}
