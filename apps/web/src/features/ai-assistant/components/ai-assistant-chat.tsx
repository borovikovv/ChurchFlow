'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { aiAssistantChatErrorKind } from '../lib/chat-error';
import {
  aiAssistantChatRequestBody,
  isAiAssistantApprovalContinuation,
  isAiAssistantSettledApprovalReply,
} from '../lib/chat-request';
import { aiAssistantPageContext } from '../lib/page-context';
import { hasPendingAiAssistantApproval, isAiAssistantAwaitingReply } from '../lib/tool-parts';
import type { AiAssistantErrorKind, AiAssistantUsageDisplay } from '../types/ai-assistant-view';
import type {
  AiAssistantChatNotice as Notice,
  AiAssistantChatProps,
} from './ai-assistant-chat.types';
import { AiAssistantChatNotice } from './ai-assistant-chat-notice';
import { AiAssistantComposer } from './ai-assistant-composer';
import { AiAssistantEmptyState } from './ai-assistant-empty-state';
import { AiAssistantMessageList } from './ai-assistant-message-list';

function chatNotice({
  errorKind,
  unavailable,
  usageDisplay,
}: {
  errorKind: AiAssistantErrorKind | null;
  unavailable: boolean;
  usageDisplay: AiAssistantUsageDisplay;
}): Notice | null {
  if (usageDisplay.kind === 'exhausted') {
    return { kind: 'exhausted', periodEndsAt: usageDisplay.periodEndsAt };
  }
  if (unavailable || errorKind === 'unavailable') return { kind: 'unavailable' };
  // The refreshed usage names the renewal date; until it arrives the generic notice would mislead.
  if (errorKind === 'quotaExhausted') return null;
  if (errorKind) return { kind: errorKind };

  return null;
}

export function AiAssistantChat({
  organizationId,
  session,
  unavailable,
  usageDisplay,
  onNavigate,
  onRefresh,
  onResponseSettled,
}: AiAssistantChatProps) {
  const pathname = usePathname();
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/v1/organizations/${encodeURIComponent(organizationId)}/ai/chat`,
        credentials: 'include',
        prepareSendMessagesRequest: ({ id, messages }) => {
          const body = aiAssistantChatRequestBody({
            conversationId: id,
            messages,
            uiContext: {
              ...aiAssistantPageContext(pathname),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          });
          if (!body) throw new Error('There is no new message or decision to send.');

          return { body };
        },
      }),
    [organizationId, pathname],
  );
  const {
    messages,
    status,
    error,
    sendMessage,
    regenerate,
    stop,
    clearError,
    addToolApprovalResponse,
  } = useChat({
    id: session.id,
    messages: session.initialMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: onResponseSettled,
    onError: onResponseSettled,
  });

  const busy = status === 'submitted' || status === 'streaming';
  const errorKind = error ? aiAssistantChatErrorKind(error) : null;
  const notice = chatNotice({ errorKind, unavailable, usageDisplay });
  const blocked =
    notice?.kind === 'exhausted' ||
    notice?.kind === 'unavailable' ||
    errorKind === 'quotaExhausted' ||
    hasPendingAiAssistantApproval(messages);

  function send(text: string) {
    clearError();
    void sendMessage({ text });
  }

  function retry() {
    clearError();
    // Regenerating would drop the assistant message that carries the user's decisions.
    if (isAiAssistantApprovalContinuation(messages)) {
      void sendMessage();
      return;
    }
    if (isAiAssistantSettledApprovalReply(messages)) {
      onRefresh();
      return;
    }
    void regenerate();
  }

  return (
    <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]">
      {messages.length === 0 ? (
        <AiAssistantEmptyState disabled={blocked || busy} onPick={send} />
      ) : (
        <AiAssistantMessageList
          messages={messages}
          organizationId={organizationId}
          thinking={isAiAssistantAwaitingReply(status, messages)}
          onApprovalResponse={(response) => void addToolApprovalResponse(response)}
          onNavigate={onNavigate}
        />
      )}
      <div className="grid gap-2">
        {notice ? (
          <div className="px-3 pt-3">
            <AiAssistantChatNotice notice={notice} onRefresh={onRefresh} onRetry={retry} />
          </div>
        ) : null}
        <AiAssistantComposer
          busy={busy}
          disabled={blocked}
          onSend={send}
          onStop={() => void stop()}
        />
      </div>
    </div>
  );
}
