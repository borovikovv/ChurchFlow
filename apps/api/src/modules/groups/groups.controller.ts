import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ORG_PERMISSIONS } from '@churchflow/shared';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../../common/guards/session-auth.guard';
import {
  OrganizationAccessGuard,
  RequireOrganizationPermission,
} from '../../common/guards/organization-access.guard';
import {
  AddOrganizationGroupMembersDto,
  CreateOrganizationGroupDto,
  UpdateOrganizationGroupDto,
  UpdateOrganizationGroupMemberDto,
} from './dto/organization-group.dto';
import { GroupsService } from './groups.service';

@Controller('organizations/:organizationId/groups')
@UseGuards(SessionAuthGuard, OrganizationAccessGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  list(@Param('organizationId') organizationId: string, @Req() request: AuthenticatedRequest) {
    return this.groupsService.listForOrganization(organizationId, this.actorUserId(request));
  }

  /** Declared before the :groupId route so the literal segment wins. */
  @Get('details')
  listDetails(
    @Param('organizationId') organizationId: string,
  ) {
    return this.groupsService.listDetailsForOrganization(organizationId);
  }

  @Get(':groupId')
  findById(
    @Param('organizationId') organizationId: string,
    @Param('groupId') groupId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.groupsService.findById(organizationId, groupId, this.actorUserId(request));
  }

  @Post()
  @RequireOrganizationPermission(ORG_PERMISSIONS.membersManage)
  create(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateOrganizationGroupDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.groupsService.create(organizationId, body, this.actorUserId(request));
  }

  @Patch(':groupId')
  @RequireOrganizationPermission(ORG_PERMISSIONS.membersManage)
  update(
    @Param('organizationId') organizationId: string,
    @Param('groupId') groupId: string,
    @Body() body: UpdateOrganizationGroupDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.groupsService.update(organizationId, groupId, body, this.actorUserId(request));
  }

  @Delete(':groupId')
  @RequireOrganizationPermission(ORG_PERMISSIONS.membersManage)
  delete(
    @Param('organizationId') organizationId: string,
    @Param('groupId') groupId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.groupsService.delete(organizationId, groupId, this.actorUserId(request));
  }

  @Post(':groupId/members')
  @RequireOrganizationPermission(ORG_PERMISSIONS.membersManage)
  addMembers(
    @Param('organizationId') organizationId: string,
    @Param('groupId') groupId: string,
    @Body() body: AddOrganizationGroupMembersDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.groupsService.addMembers(organizationId, groupId, body, this.actorUserId(request));
  }

  @Patch(':groupId/members/:membershipId')
  @RequireOrganizationPermission(ORG_PERMISSIONS.membersManage)
  updateMember(
    @Param('organizationId') organizationId: string,
    @Param('groupId') groupId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateOrganizationGroupMemberDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.groupsService.updateMember(
      organizationId,
      groupId,
      membershipId,
      body,
      this.actorUserId(request),
    );
  }

  @Delete(':groupId/members/:membershipId')
  @RequireOrganizationPermission(ORG_PERMISSIONS.membersManage)
  removeMember(
    @Param('organizationId') organizationId: string,
    @Param('groupId') groupId: string,
    @Param('membershipId') membershipId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.groupsService.removeMember(
      organizationId,
      groupId,
      membershipId,
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
