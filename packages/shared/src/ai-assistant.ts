import { z } from 'zod';

/** Where the model runs: through OpenRouter, or on DeepSeek's own API. */
export const AI_ASSISTANT_PROVIDERS = ['openrouter', 'deepseek'] as const;

export type AiAssistantProvider = (typeof AI_ASSISTANT_PROVIDERS)[number];

/** DeepSeek V4.1 Flash under the id each provider knows it by. */
export const AI_ASSISTANT_DEFAULT_MODELS: Record<AiAssistantProvider, string> = {
  openrouter: 'deepseek/deepseek-v4.1-flash',
  deepseek: 'deepseek-flash',
};

/** One user message is one action, however many tools the agent calls to answer it. */
export const AI_ASSISTANT_DEFAULT_MONTHLY_ACTION_LIMIT = 250;

/** Below this share of the limit, members who cannot see the counter are warned instead. */
export const AI_ASSISTANT_USAGE_WARNING_RATIO = 0.2;

export const AI_ASSISTANT_MESSAGE_MAX_LENGTH = 4000;

/** Message content is personal history, not a record; telemetry and audit outlive it. */
export const AI_ASSISTANT_MESSAGE_RETENTION_DAYS = 90;

export const AI_ASSISTANT_QUOTA_EXHAUSTED_ERROR_CODE = 'AI_QUOTA_EXHAUSTED';
export const AI_ASSISTANT_UNAVAILABLE_ERROR_CODE = 'AI_ASSISTANT_UNAVAILABLE';
export const AI_ASSISTANT_DUPLICATE_MESSAGE_ERROR_CODE = 'AI_DUPLICATE_MESSAGE';
export const AI_ASSISTANT_CONFIRMATION_LIMIT_ERROR_CODE = 'AI_CONFIRMATION_LIMIT';

/**
 * Confirmations continue an action the allowance already paid for, so they are free - and
 * therefore capped, or a model that keeps proposing changes would keep calling the model.
 */
export const AI_ASSISTANT_MAX_CONFIRMATIONS_PER_ACTION = 3;
export const AI_ASSISTANT_CONFIRMATION_MAX_STEPS = 3;

/** The part of the app the user is looking at, so "here" and "this person" resolve. */
export const AI_ASSISTANT_MODULES = [
  'home',
  'members',
  'groups',
  'calendar',
  'prayerRequests',
  'budget',
  'other',
] as const;

export type AiAssistantModule = (typeof AI_ASSISTANT_MODULES)[number];

export const AI_ASSISTANT_TOOL_NAMES = [
  'enableToolGroups',
  'organizationSummary',
  'searchMembers',
  'getMember',
  'listGroups',
  'getGroup',
  'addGroupMember',
  'setGroupMemberRole',
  'moveGroupMember',
  'removeGroupMember',
  'listCalendarEvents',
  'upcomingServices',
  'createCalendarEvent',
  'updateCalendarEvent',
  'deleteCalendarEvent',
  'listPrayerRequests',
  'createPrayerRequest',
  'budgetSummary',
] as const;

export type AiAssistantToolName = (typeof AI_ASSISTANT_TOOL_NAMES)[number];

/** Where a tool result points to, so the UI can link to it without knowing the tool. */
export const AI_ASSISTANT_ENTITY_KINDS = [
  'member',
  'group',
  'calendar',
  'prayerRequests',
  'budget',
] as const;

export type AiAssistantEntityKind = (typeof AI_ASSISTANT_ENTITY_KINDS)[number];

export interface AiAssistantEntityLink {
  kind: AiAssistantEntityKind;
  id: string | null;
  label: string;
}

const uuid = z.string().uuid();

export const aiAssistantUiContextSchema = z.object({
  module: z.enum(AI_ASSISTANT_MODULES),
  groupId: uuid.optional(),
  membershipId: uuid.optional(),
  timeZone: z.string().trim().min(1).max(64).optional(),
});

export type AiAssistantUiContext = z.infer<typeof aiAssistantUiContextSchema>;

export const aiAssistantApprovalDecisionSchema = z.object({
  approvalId: z.string().min(1).max(128),
  approved: z.boolean(),
});

export type AiAssistantApprovalDecision = z.infer<typeof aiAssistantApprovalDecisionSchema>;

/**
 * The client sends either a new message or its decisions on pending confirmations, never the
 * history: the server owns the conversation, so a crafted transcript cannot smuggle in an
 * approval or a tool result.
 */
export const aiAssistantChatRequestSchema = z
  .object({
    conversationId: uuid,
    message: z
      .object({
        id: z.string().min(1).max(128),
        text: z.string().trim().min(1).max(AI_ASSISTANT_MESSAGE_MAX_LENGTH),
      })
      .optional(),
    approvals: z.array(aiAssistantApprovalDecisionSchema).min(1).max(20).optional(),
    uiContext: aiAssistantUiContextSchema,
  })
  .refine((value) => Boolean(value.message) !== Boolean(value.approvals), {
    message: 'Send either a message or approval decisions',
  });

export type AiAssistantChatRequest = z.infer<typeof aiAssistantChatRequestSchema>;

export interface AiAssistantUsagePayload {
  used: number;
  limit: number;
  periodEndsAt: string;
  /** Owners and admins see the counter at all times; everyone else only near the limit. */
  canViewCounter: boolean;
}

export interface AiAssistantConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface AiAssistantConversationsPayload {
  conversations: AiAssistantConversationSummary[];
}

export interface AiAssistantTokenTotals {
  modelCalls: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  /** USD as a decimal string; the sum of stored per-call costs, never recomputed. */
  estimatedCostUsd: string;
}

/** Platform-admin view of one organization's AI consumption in one billing period. */
export interface AiAssistantAdminUsageReport extends AiAssistantTokenTotals {
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  actionsUsed: number;
  actionsLimit: number;
  requests: number;
  /** Model calls whose cost is unknown: no provider cost and no price for the model. */
  callsWithoutCost: number;
  byModel: (AiAssistantTokenTotals & { provider: string; model: string })[];
  history: {
    periodStart: string;
    actionsUsed: number;
    totalTokens: number;
    estimatedCostUsd: string;
  }[];
}

export const aiAssistantAdminUsageQuerySchema = z.object({
  periodStart: z.string().datetime({ offset: true }).optional(),
});

export type AiAssistantAdminUsageQuery = z.infer<typeof aiAssistantAdminUsageQuerySchema>;
