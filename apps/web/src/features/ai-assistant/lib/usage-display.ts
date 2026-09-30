import { AI_ASSISTANT_USAGE_WARNING_RATIO, type AiAssistantUsagePayload } from '@churchflow/shared';
import type { AiAssistantUsageDisplay } from '../types/ai-assistant-view';

/** Owners and admins always see the counter; everyone else only hears about it near the limit. */
export function aiAssistantUsageDisplay(usage: AiAssistantUsagePayload): AiAssistantUsageDisplay {
  const remaining = Math.max(0, usage.limit - usage.used);

  if (remaining === 0) return { kind: 'exhausted', periodEndsAt: usage.periodEndsAt };
  if (usage.canViewCounter) return { kind: 'counter', used: usage.used, limit: usage.limit };
  if (remaining <= usage.limit * AI_ASSISTANT_USAGE_WARNING_RATIO) {
    return { kind: 'warning', remaining };
  }

  return { kind: 'hidden' };
}
