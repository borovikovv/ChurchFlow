import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { OrganizationRequestStatus } from '@churchflow/db';
import { organizationRequestStatusSchema } from '@churchflow/shared';
import { JwtAuthGuard, type AuthenticatedRequest } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { ApproveOrganizationRequestDto } from './dto/approve-organization-request.dto';
import { CreateOrganizationRequestDto } from './dto/create-organization-request.dto';
import { RejectOrganizationRequestDto } from './dto/reject-organization-request.dto';
import { OrganizationRequestsService } from './organization-requests.service';

@Controller()
export class OrganizationRequestsController {
  constructor(private readonly organizationRequestsService: OrganizationRequestsService) {}

  @Post('organization-requests')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async create(@Body() body: CreateOrganizationRequestDto) {
    return this.organizationRequestsService.create(body);
  }

  @Get('admin/organization-requests')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async list(@Query('status') status?: string) {
    const parsedStatus: OrganizationRequestStatus | undefined = status
      ? organizationRequestStatusSchema.parse(status)
      : undefined;
    return this.organizationRequestsService.list(parsedStatus);
  }

  @Get('admin/organization-requests/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async get(@Param('id') id: string) {
    return this.organizationRequestsService.get(id);
  }

  @Post('admin/organization-requests/:id/approve')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async approve(
    @Param('id') id: string,
    @Body() body: ApproveOrganizationRequestDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.organizationRequestsService.approve(id, body, this.getActorUserId(request));
  }

  @Post('admin/organization-requests/:id/reject')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async reject(
    @Param('id') id: string,
    @Body() body: RejectOrganizationRequestDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.organizationRequestsService.reject(id, body, this.getActorUserId(request));
  }

  private getActorUserId(request: AuthenticatedRequest): string {
    const userId = request.auth?.sub;
    if (!userId) {
      throw new Error('Authenticated request missing auth payload');
    }

    return userId;
  }
}
