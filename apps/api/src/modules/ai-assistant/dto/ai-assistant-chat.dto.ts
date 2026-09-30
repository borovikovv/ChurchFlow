import { aiAssistantAdminUsageQuerySchema, aiAssistantChatRequestSchema } from '@churchflow/shared';
import type { AiAssistantAdminUsageQuery, AiAssistantChatRequest } from '@churchflow/shared';

export class AiAssistantChatDto implements AiAssistantChatRequest {
  static readonly schema = aiAssistantChatRequestSchema;

  conversationId!: string;
  message?: AiAssistantChatRequest['message'];
  approvals?: AiAssistantChatRequest['approvals'];
  uiContext!: AiAssistantChatRequest['uiContext'];
}

export class AiAssistantAdminUsageQueryDto implements AiAssistantAdminUsageQuery {
  static readonly schema = aiAssistantAdminUsageQuerySchema;

  periodStart?: string;
}
