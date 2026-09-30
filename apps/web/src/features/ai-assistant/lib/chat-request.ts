import type {
  AiAssistantApprovalDecision,
  AiAssistantChatRequest,
  AiAssistantUiContext,
} from '@churchflow/shared';
import { isToolUIPart, type UIMessage } from 'ai';

function messageText(message: UIMessage): string {
  return message.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n')
    .trim();
}

function approvalDecisions(message: UIMessage): AiAssistantApprovalDecision[] {
  return message.parts.flatMap((part) =>
    isToolUIPart(part) && part.state === 'approval-responded'
      ? [{ approvalId: part.approval.id, approved: part.approval.approved }]
      : [],
  );
}

/**
 * The server owns the conversation, so a request carries only what is new: the user's latest
 * message, or the decisions on confirmations the assistant is waiting for.
 */
export function aiAssistantChatRequestBody({
  conversationId,
  messages,
  uiContext,
}: {
  conversationId: string;
  messages: UIMessage[];
  uiContext: AiAssistantUiContext;
}): AiAssistantChatRequest | null {
  const lastMessage = messages.at(-1);
  if (!lastMessage) return null;

  if (lastMessage.role === 'user') {
    const text = messageText(lastMessage);

    return text ? { conversationId, uiContext, message: { id: lastMessage.id, text } } : null;
  }

  const approvals = approvalDecisions(lastMessage);

  return approvals.length > 0 ? { conversationId, uiContext, approvals } : null;
}

/** A failed approval continuation is retried as is; removing the message would lose the decisions. */
export function isAiAssistantApprovalContinuation(messages: UIMessage[]): boolean {
  const lastMessage = messages.at(-1);

  return lastMessage?.role === 'assistant' && approvalDecisions(lastMessage).length > 0;
}

/**
 * A reply that failed after a confirmed action ran cannot be resent: the server already answered
 * those decisions. Reloading the stored conversation shows what actually happened.
 */
export function isAiAssistantSettledApprovalReply(messages: UIMessage[]): boolean {
  const lastMessage = messages.at(-1);

  return (
    lastMessage?.role === 'assistant' &&
    lastMessage.parts.some(
      (part) =>
        isToolUIPart(part) &&
        part.approval !== undefined &&
        part.state !== 'approval-requested' &&
        part.state !== 'approval-responded',
    )
  );
}
