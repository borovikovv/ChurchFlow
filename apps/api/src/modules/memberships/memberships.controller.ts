import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../../common/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { MembershipsService } from './memberships.service';
import { UpdateMembershipRoleDto } from './dto/update-membership-role.dto';
import { CreateManualMemberDto } from './dto/create-manual-member.dto';
import { UpdateMemberProfileDto } from './dto/update-member-profile.dto';
import { ListMembershipsQueryDto } from './dto/list-memberships-query.dto';

@Controller('organizations/:organizationId/memberships')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  async list(
    @Param('organizationId') organizationId: string,
    @Query() query: ListMembershipsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.membershipsService.listForOrganization(
      organizationId,
      this.getActorUserId(request),
      query.access,
    );
  }

  @Post('manual')
  async createManual(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateManualMemberDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.membershipsService.createManualMember(
      organizationId,
      body,
      this.getActorUserId(request),
    );
  }

  @Patch(':membershipId/profile')
  async updateProfile(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateMemberProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.membershipsService.updateProfile(
      organizationId,
      membershipId,
      body,
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
