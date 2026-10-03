import { HttpException, Logger } from '@nestjs/common';
import type { AiToolRisk, Prisma } from '@churchflow/db';
import type {
  AiAssistantEntityLink,
  AiAssistantToolName,
  AppLocale,
  Entitlement,
} from '@churchflow/shared';
import { ZodError } from 'zod';
import type { OrganizationPermission } from '../../../common/guards/organization-access.guard';

/** Tools are offered to the model in groups, so a request only pays for the schemas it needs. */
export const AI_TOOL_GROUPS = [
  'members',
  'groups',
  'calendar',
  'prayers',
  'budget',
  'knowledge',
] as const;

export type AiToolGroup = (typeof AI_TOOL_GROUPS)[number] | 'core';

/**
 * What the HTTP route behind a tool requires. Copied from the route's decorators rather than
 * inferred, and a test holds the two together, so the assistant can never be granted more than
 * the button the user would otherwise press.
 */
export interface AiToolPolicy {
  permission?: OrganizationPermission;
  ownerRequired?: boolean;
  entitlement?: Entitlement;
}

export interface AiToolRoute {
  controller: abstract new (...args: never[]) => unknown;
  handler: string;
}

export interface AiToolMeta {
  name: AiAssistantToolName;
  group: AiToolGroup;
  risk: AiToolRisk;
  policy: AiToolPolicy;
  /** Null only for tools that compose several reads and have no single route to mirror. */
  route: AiToolRoute | null;
}

export type AiToolOutput<TData = undefined> =
  | { ok: true; summary: string; links: AiAssistantEntityLink[]; data?: TData }
  | { ok: false; error: string };

export interface AiToolContext {
  organizationId: string;
  userId: string;
  conversationId: string;
  requestId: string;
  /** Tool-call id to approval id of every proposal the user confirmed in this request. */
  confirmedApprovals: ReadonlyMap<string, string>;
  locale: AppLocale;
  timeZone: string;
  now: Date;
}

const toolErrorLogger = new Logger('AiAssistantTools');
const UNEXPECTED_TOOL_ERROR = 'The action could not be completed. Try again later.';

/**
 * Turns a failure into something the model can explain to the user. Only messages the API
 * already shows its clients pass through; anything unexpected is logged and replaced, so an
 * internal error never reaches the conversation.
 */
export function toolErrorMessage(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'object' && 'message' in response) {
      const { message } = response;
      if (Array.isArray(message))
        return message.filter((item) => typeof item === 'string').join('; ');
      if (typeof message === 'string') return message;
    }

    return error.message;
  }

  if (error instanceof ZodError) {
    return error.issues
      .map((issue) =>
        issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
      )
      .join('; ');
  }

  toolErrorLogger.error(
    {
      event: 'AI tool failed unexpectedly',
      message: error instanceof Error ? error.message : null,
    },
    error instanceof Error ? error.stack : undefined,
  );

  return UNEXPECTED_TOOL_ERROR;
}

export function localized(locale: AppLocale, messages: Record<AppLocale, string>): string {
  return messages[locale];
}

export type AiJsonInputValue =
  | string
  | number
  | boolean
  | null
  | readonly AiJsonInputValue[]
  | { readonly [key: string]: AiJsonInputValue | undefined };

/** Tool input as stored with its execution: validated arguments, with absent keys dropped. */
export function jsonInput(value: {
  readonly [key: string]: AiJsonInputValue | undefined;
}): Prisma.InputJsonObject {
  const entries: [string, Prisma.InputJsonValue | null][] = [];
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) entries.push([key, jsonValue(item)]);
  }

  return Object.fromEntries(entries);
}

function jsonValue(value: AiJsonInputValue): Prisma.InputJsonValue | null {
  if (value === null || typeof value !== 'object') return value;
  if (isJsonArray(value)) return value.map((item) => jsonValue(item));

  return jsonInput(value);
}

function isJsonArray(
  value: readonly AiJsonInputValue[] | { readonly [key: string]: AiJsonInputValue | undefined },
): value is readonly AiJsonInputValue[] {
  return Array.isArray(value);
}

export function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** Anything the SDK hands back - UI message parts, tool input - reduced to storable JSON. */
export function jsonFromUnknown(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map((item) => jsonFromUnknown(item));
  if (typeof value === 'object') {
    const entries: [string, Prisma.InputJsonValue | null][] = [];
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) entries.push([key, jsonFromUnknown(item)]);
    }

    return Object.fromEntries(entries);
  }

  return null;
}
