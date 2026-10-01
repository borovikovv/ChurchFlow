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
  CreateKnowledgeEntryDto,
  ListKnowledgeEntriesQueryDto,
  UpdateKnowledgeEntryDto,
} from './dto/knowledge.dto';
import { KnowledgeEntriesService } from './knowledge-entries.service';
import { actorUserId } from './knowledge-request';

@Controller('organizations/:organizationId/knowledge')
@UseGuards(SessionAuthGuard, OrganizationAccessGuard)
export class KnowledgeEntriesController {
  constructor(private readonly knowledgeEntriesService: KnowledgeEntriesService) {}

  @Get()
  list(
    @Param('organizationId') organizationId: string,
    @Query() query: ListKnowledgeEntriesQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.knowledgeEntriesService.list(organizationId, actorUserId(request), query);
  }

  @Get(':entryId')
  get(
    @Param('organizationId') organizationId: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.knowledgeEntriesService.get(organizationId, entryId, actorUserId(request));
  }

  @Post()
  @RequireOrganizationPermission(ORG_PERMISSIONS.knowledgeManage)
  create(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateKnowledgeEntryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.knowledgeEntriesService.create(organizationId, body, actorUserId(request));
  }

  @Patch(':entryId')
  @RequireOrganizationPermission(ORG_PERMISSIONS.knowledgeManage)
  update(
    @Param('organizationId') organizationId: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() body: UpdateKnowledgeEntryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.knowledgeEntriesService.update(organizationId, entryId, body, actorUserId(request));
  }

  @Delete(':entryId')
  @RequireOrganizationPermission(ORG_PERMISSIONS.knowledgeManage)
  delete(
    @Param('organizationId') organizationId: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.knowledgeEntriesService.delete(organizationId, entryId, actorUserId(request));
  }
}
