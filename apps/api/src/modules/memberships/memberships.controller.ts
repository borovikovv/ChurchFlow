import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../../common/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { MembershipsService } from './memberships.service';

@Controller('organizations/:organizationId/memberships')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  async list(@Param('organizationId') organizationId: string) {
    return this.membershipsService.listForOrganization(organizationId);
  }

  @Post(':membershipId/remove')
  async remove(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.membershipsService.removeMember(
      organizationId,
      membershipId,
      this.getActorUserId(request)
    );
  }

  private getActorUserId(request: AuthenticatedRequest): string {
    const userId = request.auth?.sub;
    if (!userId) {
      throw new Error('Authenticated request missing auth payload');
    }

    return userId;
  }
}
