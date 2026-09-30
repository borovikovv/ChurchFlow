'use client';

import { useTranslations } from 'next-intl';
import { isToolUIPart, type UIMessage } from 'ai';
import {
  AI_ASSISTANT_MESSAGE_TEXT_CLASS_NAME,
  AI_ASSISTANT_THINKING_CLASS_NAME,
  AI_ASSISTANT_THINKING_DOT_CLASS_NAMES,
  aiAssistantMessageClassName,
} from './ai-assistant-message-list.styles';
import { AiAssistantToolPart } from './ai-assistant-tool-part';

export function AiAssistantMessageList({
  messages,
  organizationId,
  thinking,
  onApprovalResponse,
  onNavigate,
}: {
  messages: UIMessage[];
  organizationId: string;
  thinking: boolean;
  onApprovalResponse: (response: { id: string; approved: boolean }) => void;
  onNavigate: () => void;
}) {
  const t = useTranslations('aiAssistant');

  return (
    // column-reverse keeps the view pinned to the newest message as the reply streams in.
    <div className="flex min-h-0 flex-col-reverse overflow-y-auto overscroll-contain">
      <ol aria-live="polite" className="m-0 grid list-none content-start gap-4 p-4">
        {messages.map((message) => (
          <li
            className={aiAssistantMessageClassName({
              role: message.role === 'user' ? 'user' : 'assistant',
            })}
            key={message.id}
          >
            {message.parts.map((part, index) => {
              const key = `${message.id}:${index}`;

              if (part.type === 'text') {
                return (
                  <p className={AI_ASSISTANT_MESSAGE_TEXT_CLASS_NAME} key={key}>
                    {part.text}
                  </p>
                );
              }

              if (message.role === 'assistant' && isToolUIPart(part)) {
                return (
                  <AiAssistantToolPart
                    key={part.toolCallId}
                    organizationId={organizationId}
                    part={part}
                    onApprovalResponse={onApprovalResponse}
                    onNavigate={onNavigate}
                  />
                );
              }

              return null;
            })}
          </li>
        ))}
        {thinking ? (
          <li className={AI_ASSISTANT_THINKING_CLASS_NAME} role="status">
            <span aria-hidden="true" className="flex gap-1">
              {AI_ASSISTANT_THINKING_DOT_CLASS_NAMES.map((className) => (
                <span className={className} key={className} />
              ))}
            </span>
            {t('thinking')}
          </li>
        ) : null}
      </ol>
    </div>
  );
}
