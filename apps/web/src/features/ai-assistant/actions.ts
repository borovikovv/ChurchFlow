'use server';

import type { AiAssistantConversationsPayload, AiAssistantUsagePayload } from '@churchflow/shared';
import { apiFetch } from '@/api/client';
import type { AiAssistantMessagesPayload } from '@/api/types/ai-assistant';

type AiAssistantLoadResult<T> =
  | { ok: true; payload: T }
  | { ok: false; code: string; error: string };

async function loadFromApi<T>(path: string): Promise<AiAssistantLoadResult<T>> {
  const result = await apiFetch<T>(path);
  if (!result.ok) return { ok: false, code: result.error.code, error: result.error.message };

  return { ok: true, payload: result.data };
}

function assistantPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/ai`;
}

export async function loadAiAssistantUsageAction(organizationId: string) {
  return loadFromApi<AiAssistantUsagePayload>(`${assistantPath(organizationId)}/usage`);
}

export async function loadAiAssistantConversationsAction(organizationId: string) {
  return loadFromApi<AiAssistantConversationsPayload>(
    `${assistantPath(organizationId)}/conversations`,
  );
}

export async function loadAiAssistantMessagesAction(input: {
  organizationId: string;
  conversationId: string;
}) {
  return loadFromApi<AiAssistantMessagesPayload>(
    `${assistantPath(input.organizationId)}/conversations/${encodeURIComponent(
      input.conversationId,
    )}/messages`,
  );
}
