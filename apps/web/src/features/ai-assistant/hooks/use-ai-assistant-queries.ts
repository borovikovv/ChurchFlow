'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  loadAiAssistantConversationsAction,
  loadAiAssistantMessagesAction,
  loadAiAssistantUsageAction,
} from '../actions';
import { aiAssistantErrorKindFromCode } from '../lib/chat-error';

const AI_ASSISTANT_QUERY_KEY = 'ai-assistant';

function usageQueryKey(organizationId: string) {
  return [AI_ASSISTANT_QUERY_KEY, organizationId, 'usage'] as const;
}

function conversationsQueryKey(organizationId: string) {
  return [AI_ASSISTANT_QUERY_KEY, organizationId, 'conversations'] as const;
}

function messagesQueryKey(organizationId: string, conversationId: string) {
  return [AI_ASSISTANT_QUERY_KEY, organizationId, 'messages', conversationId] as const;
}

class AiAssistantLoadError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export function useAiAssistantUsage(organizationId: string, enabled: boolean) {
  const query = useQuery({
    enabled,
    queryKey: usageQueryKey(organizationId),
    queryFn: async () => {
      const result = await loadAiAssistantUsageAction(organizationId);
      if (!result.ok) throw new AiAssistantLoadError(result.error, result.code);
      return result.payload;
    },
  });
  const errorKind =
    query.error instanceof AiAssistantLoadError
      ? aiAssistantErrorKindFromCode(query.error.code)
      : null;

  return { ...query, errorKind };
}

export function useAiAssistantConversations(organizationId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: conversationsQueryKey(organizationId),
    queryFn: async () => {
      const result = await loadAiAssistantConversationsAction(organizationId);
      if (!result.ok) throw new AiAssistantLoadError(result.error, result.code);
      return result.payload.conversations;
    },
  });
}

/** Loads a stored conversation on demand, when the user opens it from the history. */
export function useFetchAiAssistantMessages(organizationId: string) {
  const queryClient = useQueryClient();

  return useCallback(
    (conversationId: string) =>
      queryClient.fetchQuery({
        queryKey: messagesQueryKey(organizationId, conversationId),
        queryFn: async () => {
          const result = await loadAiAssistantMessagesAction({ organizationId, conversationId });
          if (!result.ok) throw new AiAssistantLoadError(result.error, result.code);
          return result.payload.messages;
        },
        // The open chat owns the conversation from here; a cached copy would be stale next time.
        staleTime: 0,
        gcTime: 0,
      }),
    [organizationId, queryClient],
  );
}

/** A finished response spends an action and may have created or renamed a conversation. */
export function useRefreshAiAssistantActivity(organizationId: string): () => void {
  const queryClient = useQueryClient();

  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: usageQueryKey(organizationId) });
    void queryClient.invalidateQueries({ queryKey: conversationsQueryKey(organizationId) });
  }, [organizationId, queryClient]);
}
