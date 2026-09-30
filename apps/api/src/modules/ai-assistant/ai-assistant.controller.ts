import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { pipeUIMessageStreamToResponse } from 'ai';
import type { Response } from 'express';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../../common/guards/session-auth.guard';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantChatDto } from './dto/ai-assistant-chat.dto';

@Controller('organizations/:organizationId/ai')
@UseGuards(SessionAuthGuard, OrganizationAccessGuard)
export class AiAssistantController {
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  @Get('usage')
  usage(@Param('organizationId') organizationId: string, @Req() request: AuthenticatedRequest) {
    return this.aiAssistantService.usage(this.actorUserId(request), organizationId);
  }

  @Get('conversations')
  conversations(
    @Param('organizationId') organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.aiAssistantService.conversations(this.actorUserId(request), organizationId);
  }

  @Get('conversations/:conversationId/messages')
  conversationMessages(
    @Param('organizationId') organizationId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.aiAssistantService.conversationMessages(
      this.actorUserId(request),
      organizationId,
      conversationId,
    );
  }

  /** Streams the reply; refusals (quota, subscription, duplicates) are thrown before any byte. */
  @Post('chat')
  async chat(
    @Param('organizationId') organizationId: string,
    @Body() body: AiAssistantChatDto,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    const stream = await this.aiAssistantService.chat({
      userId: this.actorUserId(request),
      organizationId,
      channel: 'web',
      request: body,
    });

    // no-transform keeps the web app's gzip from buffering the stream it proxies.
    await pipeUIMessageStreamToResponse({
      response,
      stream,
      headers: { 'cache-control': 'no-cache, no-transform' },
    });
  }

  private actorUserId(request: AuthenticatedRequest): string {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new Error('Authenticated request missing auth payload');
    }

    return userId;
  }
}
