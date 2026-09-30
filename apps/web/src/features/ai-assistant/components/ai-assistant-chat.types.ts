import type { AiAssistantSession } from './ai-assistant-panel.types';
import type { AiAssistantUsageDisplay } from '../types/ai-assistant-view';

/** What stands between the user and the composer, most blocking first. */
export type AiAssistantChatNotice =
  | { kind: 'exhausted'; periodEndsAt: string }
  | { kind: 'unavailable' }
  | { kind: 'duplicate' }
  | { kind: 'confirmationLimit' }
  | { kind: 'generic' };

export interface AiAssistantChatProps {
  organizationId: string;
  session: AiAssistantSession;
  unavailable: boolean;
  usageDisplay: AiAssistantUsageDisplay;
  onNavigate: () => void;
  onRefresh: () => void;
  onResponseSettled: () => void;
}
