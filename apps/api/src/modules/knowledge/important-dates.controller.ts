import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ORG_PERMISSIONS } from '@churchflow/shared';
import {
  OrganizationAccessGuard,
  RequireOrganizationPermission,
} from '../../common/guards/organization-access.guard';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../../common/guards/session-auth.guard';
import {
  CreateImportantDateDto,
  ListImportantDatesQueryDto,
  UpdateImportantDateDto,
} from './dto/knowledge.dto';
import { ImportantDatesService } from './important-dates.service';
import { actorUserId } from './knowledge-request';

@Controller('organizations/:organizationId/important-dates')
@UseGuards(SessionAuthGuard, OrganizationAccessGuard)
export class ImportantDatesController {
  constructor(private readonly importantDatesService: ImportantDatesService) {}

  @Get()
  list(
    @Param('organizationId') organizationId: string,
    @Query() query: ListImportantDatesQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.importantDatesService.list(organizationId, actorUserId(request), query);
  }

  @Get(':dateId')
  get(
    @Param('organizationId') organizationId: string,
    @Param('dateId', ParseUUIDPipe) dateId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.importantDatesService.get(organizationId, dateId, actorUserId(request));
  }

  @Post()
  @RequireOrganizationPermission(ORG_PERMISSIONS.knowledgeManage)
  create(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateImportantDateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.importantDatesService.create(organizationId, body, actorUserId(request));
  }

  @Patch(':dateId')
  @RequireOrganizationPermission(ORG_PERMISSIONS.knowledgeManage)
  update(
    @Param('organizationId') organizationId: string,
    @Param('dateId', ParseUUIDPipe) dateId: string,
    @Body() body: UpdateImportantDateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.importantDatesService.update(organizationId, dateId, body, actorUserId(request));
  }

  @Delete(':dateId')
  @RequireOrganizationPermission(ORG_PERMISSIONS.knowledgeManage)
  delete(
    @Param('organizationId') organizationId: string,
    @Param('dateId', ParseUUIDPipe) dateId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.importantDatesService.delete(organizationId, dateId, actorUserId(request));
  }
}
