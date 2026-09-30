import {
  AI_ASSISTANT_ENTITY_KINDS,
  AI_ASSISTANT_TOOL_NAMES,
  type AiAssistantToolName,
} from '@churchflow/shared';
import {
  getToolName,
  isToolUIPart,
  type ChatStatus,
  type DynamicToolUIPart,
  type ToolUIPart,
  type UIMessage,
} from 'ai';
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

/**
 * Whether the assistant is working with nothing on screen moving: before the first word, between
 * a finished tool and the next step, or during hidden work such as loading more tools or
 * reasoning. A streaming sentence or a running tool chip already shows progress on its own.
 */
export function isAiAssistantAwaitingReply(status: ChatStatus, messages: UIMessage[]): boolean {
  if (status === 'submitted') return true;
  if (status !== 'streaming') return false;

  const lastMessage = messages.at(-1);
  const lastPart = lastMessage?.role === 'assistant' ? lastMessage.parts.at(-1) : undefined;
  if (!lastPart) return true;
  if (lastPart.type === 'text') return lastPart.state !== 'streaming';
  if (isToolUIPart(lastPart)) {
    const visibleAndRunning =
      isVisibleAiAssistantTool(getToolName(lastPart)) &&
      aiAssistantToolStatus(lastPart) === 'running';

    return !visibleAndRunning;
  }

  return true;
}
