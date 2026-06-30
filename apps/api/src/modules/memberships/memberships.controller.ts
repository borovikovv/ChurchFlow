import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../../common/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { MembershipsService } from './memberships.service';
import { UpdateMembershipRoleDto } from './dto/update-membership-role.dto';

@Controller('organizations/:organizationId/memberships')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  async list(
    @Param('organizationId') organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.membershipsService.listForOrganization(
      organizationId,
      this.getActorUserId(request),
    );
  }

  @Patch(':membershipId/role')
  async updateRole(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateMembershipRoleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.membershipsService.updateRole(
      organizationId,
      membershipId,
      body.role,
      this.getActorUserId(request),
    );
  }

  @Post(':membershipId/remove')
  async remove(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.membershipsService.removeMember(
      organizationId,
      membershipId,
      this.getActorUserId(request),
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
