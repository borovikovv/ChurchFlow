import {
  AI_ASSISTANT_ENTITY_KINDS,
  AI_ASSISTANT_TOOL_NAMES,
  type AiAssistantToolName,
} from '@churchflow/shared';
import { isToolUIPart, type DynamicToolUIPart, type ToolUIPart, type UIMessage } from 'ai';
import { z } from 'zod';
import type { AiAssistantToolResult, AiAssistantToolStatus } from '../types/ai-assistant-view';

export type AiAssistantToolPart = ToolUIPart | DynamicToolUIPart;

/** Tools the agent uses to organize itself; they mean nothing to the user. */
const INTERNAL_TOOL_NAMES: ReadonlySet<string> = new Set<AiAssistantToolName>(['enableToolGroups']);

// Read tools may return more fields than these; only the common envelope is rendered.
const toolResultSchema = z.union([
  z.object({
    ok: z.literal(true),
    summary: z.string(),
    links: z
      .array(
        z.object({
          kind: z.enum(AI_ASSISTANT_ENTITY_KINDS),
          id: z.string().nullable(),
          label: z.string(),
        }),
      )
      .default([]),
  }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

export function isAiAssistantToolName(name: string): name is AiAssistantToolName {
  return AI_ASSISTANT_TOOL_NAMES.some((toolName) => toolName === name);
}

export function isVisibleAiAssistantTool(name: string): boolean {
  return !INTERNAL_TOOL_NAMES.has(name);
}

export function aiAssistantToolResult(output: unknown): AiAssistantToolResult | null {
  const parsed = toolResultSchema.safeParse(output);

  return parsed.success ? parsed.data : null;
}

export function aiAssistantToolStatus(part: AiAssistantToolPart): AiAssistantToolStatus {
  switch (part.state) {
    case 'output-available':
      return aiAssistantToolResult(part.output)?.ok === false ? 'error' : 'done';
    case 'output-error':
      return 'error';
    case 'output-denied':
      return 'denied';
    default:
      return 'running';
  }
}

/** The assistant is waiting for the user to confirm or cancel an action. */
export function hasPendingAiAssistantApproval(messages: UIMessage[]): boolean {
  const lastMessage = messages.at(-1);

  return (
    lastMessage?.role === 'assistant' &&
    lastMessage.parts.some((part) => isToolUIPart(part) && part.state === 'approval-requested')
  );
}
