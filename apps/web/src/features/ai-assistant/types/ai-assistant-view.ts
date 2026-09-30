import type { AiAssistantEntityLink, AiAssistantUiContext } from '@churchflow/shared';

/** The part of the UI context the current page decides; the time zone is added on send. */
export type AiAssistantPageContext = Omit<AiAssistantUiContext, 'timeZone'>;

export type AiAssistantUsageDisplay =
  | { kind: 'hidden' }
  | { kind: 'counter'; used: number; limit: number }
  | { kind: 'warning'; remaining: number }
  | { kind: 'exhausted'; periodEndsAt: string };

export type AiAssistantErrorKind =
  | 'quotaExhausted'
  | 'unavailable'
  | 'duplicate'
  | 'confirmationLimit'
  | 'generic';

export type AiAssistantToolStatus = 'running' | 'done' | 'error' | 'denied';

export type AiAssistantToolResult =
  | { ok: true; summary: string; links: AiAssistantEntityLink[] }
  | { ok: false; error: string };
