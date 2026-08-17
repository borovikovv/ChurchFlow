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
import { JwtAuthGuard, type AuthenticatedRequest } from '../../common/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import {
  CreatePrayerRequestDto,
  ListPrayerRequestsQueryDto,
  UpdatePrayerRequestDto,
} from './dto/prayer-request.dto';
import { PrayerRequestsService } from './prayer-requests.service';

@Controller('organizations/:organizationId/prayer-requests')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class PrayerRequestsController {
  constructor(private readonly prayerRequestsService: PrayerRequestsService) {}

  @Get()
  list(
    @Param('organizationId') organizationId: string,
    @Query() query: ListPrayerRequestsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.prayerRequestsService.listForOrganization(
      organizationId,
      this.actorUserId(request),
      query,
    );
  }

  @Post()
  create(
    @Param('organizationId') organizationId: string,
    @Body() body: CreatePrayerRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.prayerRequestsService.create(organizationId, body, this.actorUserId(request));
  }

  @Patch(':requestId')
  update(
    @Param('organizationId') organizationId: string,
    @Param('requestId') requestId: string,
    @Body() body: UpdatePrayerRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.prayerRequestsService.update(
      organizationId,
      requestId,
      body,
      this.actorUserId(request),
    );
  }

  @Post(':requestId/archive')
  archive(
    @Param('organizationId') organizationId: string,
    @Param('requestId') requestId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.prayerRequestsService.archive(organizationId, requestId, this.actorUserId(request));
  }

  @Post(':requestId/restore')
  restore(
    @Param('organizationId') organizationId: string,
    @Param('requestId') requestId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.prayerRequestsService.restore(organizationId, requestId, this.actorUserId(request));
  }

  @Delete(':requestId')
  delete(
    @Param('organizationId') organizationId: string,
    @Param('requestId') requestId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.prayerRequestsService.delete(organizationId, requestId, this.actorUserId(request));
  }

  private actorUserId(request: AuthenticatedRequest): string {
    const userId = request.auth?.sub;
    if (!userId) {
      throw new Error('Authenticated request missing auth payload');
    }

    return userId;
  }
}
