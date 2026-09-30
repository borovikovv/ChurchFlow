import type { UIMessage } from 'ai';

/** Stored conversation history, already in the shape useChat renders. */
export interface AiAssistantMessagesPayload {
  messages: UIMessage[];
}
