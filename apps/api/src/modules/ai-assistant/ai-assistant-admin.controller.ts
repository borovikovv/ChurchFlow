import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantAdminUsageQueryDto } from './dto/ai-assistant-chat.dto';

/** Token and cost accounting is for platform admins; organizations only ever see their actions. */
@Controller('admin/organizations/:organizationId/ai-usage')
@UseGuards(SessionAuthGuard, PlatformAdminGuard)
export class AiAssistantAdminController {
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  @Get()
  report(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() query: AiAssistantAdminUsageQueryDto,
  ) {
    return this.aiAssistantService.adminUsageReport(organizationId, query);
  }
}
