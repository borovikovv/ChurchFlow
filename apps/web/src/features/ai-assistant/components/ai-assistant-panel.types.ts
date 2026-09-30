import type { UIMessage } from 'ai';

export type AiAssistantPanelView = 'chat' | 'history';

/** The conversation on screen. `revision` remounts the chat when its history is reloaded. */
export interface AiAssistantSession {
  id: string;
  initialMessages: UIMessage[];
  revision: number;
}
