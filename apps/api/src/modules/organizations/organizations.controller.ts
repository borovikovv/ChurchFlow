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
import { createOrganizationSchema, organizationStatusSchema } from '@churchflow/shared';
import type { OrganizationStatus } from '@churchflow/db';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../../common/guards/session-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { ListAdminOrganizationWorkspaceQueryDto } from './dto/list-admin-organization-workspace-query.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller()
@UseGuards(SessionAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('/organizations/mine')
  async listMine(@Req() request: AuthenticatedRequest) {
    return this.organizationsService.listMine(this.getActorUserId(request));
  }

  @Get('/admin/organizations')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  async listAdmin(@Query('status') status?: string) {
    const parsedStatus: OrganizationStatus | undefined = status
      ? organizationStatusSchema.parse(status)
      : undefined;
    return this.organizationsService.listAdmin(parsedStatus);
  }

  @Get('/admin/organizations/workspace')
  async listWorkspace(
    @Query() query: ListAdminOrganizationWorkspaceQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organizationsService.listWorkspace(
      this.getActorUserId(request),
      query.view,
      query.status,
    );
  }

  @Get('/admin/organizations/:id')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  async getAdmin(@Param('id') id: string) {
    return this.organizationsService.getAdmin(id);
  }

  @Post('/admin/organizations/:id/archive')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  async archive(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.organizationsService.archive(id, this.getActorUserId(request));
  }

  @Post('/admin/organizations/:id/suspend')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  async suspend(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.organizationsService.suspend(id, this.getActorUserId(request));
  }

  @Post('/admin/organizations/:id/restore')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  async restore(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.organizationsService.restore(id, this.getActorUserId(request));
  }

  @Post('/admin/organizations/:id/delete-soft')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  async deleteSoft(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.organizationsService.deleteSoft(id, this.getActorUserId(request));
  }

  @Delete('/admin/organizations/:id')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  async delete(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.organizationsService.deleteSoft(id, this.getActorUserId(request));
  }

  @Post('organizations')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  async create(@Body() body: CreateOrganizationDto, @Req() request: AuthenticatedRequest) {
    const auth = request.auth;
    if (!auth) {
      throw new Error('Authenticated request missing auth payload');
    }

    return this.organizationsService.create(createOrganizationSchema.parse(body), auth.userId);
  }

  @Patch('/organizations/:organizationId')
  async update(
    @Param('organizationId') organizationId: string,
    @Body() body: UpdateOrganizationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organizationsService.update(organizationId, body, this.getActorUserId(request));
  }

  private getActorUserId(request: AuthenticatedRequest): string {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new Error('Authenticated request missing auth payload');
    }

    return userId;
  }
}
