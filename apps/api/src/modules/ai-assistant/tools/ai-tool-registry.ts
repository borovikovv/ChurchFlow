import type { ToolApprovalStatus } from 'ai';
import type { OrganizationRole } from '@churchflow/db';
import type { AiAssistantToolName } from '@churchflow/shared';
import type { BudgetsService } from '../../budgets/budgets.service';
import type { CalendarEventsService } from '../../calendar-events/calendar-events.service';
import type { GroupsService } from '../../groups/groups.service';
import type { MembershipsService } from '../../memberships/memberships.service';
import type { PrayerRequestsService } from '../../prayer-requests/prayer-requests.service';
import { localized, type AiToolGroup, type AiToolMeta } from './ai-tool';
import type { AiNameResolver } from './ai-name-resolver';
import type { AiToolRunner } from './ai-tool-runner';
import { BUDGET_TOOL_META, budgetTools } from './budget.tools';
import { CALENDAR_TOOL_META, calendarApprovalReasons, calendarTools } from './calendar.tools';
import { GROUPS_TOOL_META, groupsApprovalReasons, groupsTools } from './groups.tools';
import { MEMBERS_TOOL_META, membersTools } from './members.tools';
import { ORGANIZATION_TOOL_META, organizationTools } from './organization.tools';
import { PRAYERS_TOOL_META, prayersApprovalReasons, prayersTools } from './prayers.tools';

export const AI_TOOL_META = {
  ...ORGANIZATION_TOOL_META,
  ...MEMBERS_TOOL_META,
  ...GROUPS_TOOL_META,
  ...CALENDAR_TOOL_META,
  ...PRAYERS_TOOL_META,
  ...BUDGET_TOOL_META,
} satisfies Record<AiAssistantToolName, AiToolMeta>;

export interface AiDomainServices {
  membershipsService: MembershipsService;
  groupsService: GroupsService;
  calendarEventsService: CalendarEventsService;
  prayerRequestsService: PrayerRequestsService;
  budgetsService: BudgetsService;
}

export function buildAiToolSet(runner: AiToolRunner, services: AiDomainServices) {
  return {
    ...organizationTools(runner, services),
    ...membersTools(runner, services.membershipsService),
    ...groupsTools(runner, services.groupsService),
    ...calendarTools(runner, services.calendarEventsService),
    ...prayersTools(runner, services.prayerRequestsService),
    ...budgetTools(runner, services.budgetsService),
  };
}

export type AiToolSet = ReturnType<typeof buildAiToolSet>;

/**
 * Every tool that changes data waits for the user. The reason is what the confirmation card
 * says, so it names people and groups instead of repeating the model's arguments.
 */
export interface AiToolApprovalPolicy {
  blockNewProposals: boolean;
  confirmedToolCallIds: ReadonlySet<string>;
}

export function buildToolApproval(
  runner: AiToolRunner,
  names: AiNameResolver,
  policy: AiToolApprovalPolicy,
) {
  const groups = groupsApprovalReasons(runner, names);
  const calendar = calendarApprovalReasons(runner, names);
  const prayers = prayersApprovalReasons(runner);
  const blockedReason = localized(runner.context.locale, {
    en: 'No more changes can be confirmed in this action. Ask the user to send a new message.',
    uk: 'У цій дії більше не можна підтверджувати зміни. Попросіть користувача надіслати нове повідомлення.',
  });
  const confirmWith =
    <TInput>(describe: (input: TInput) => string | Promise<string>) =>
    async (input: TInput, options: { toolCallId: string }): Promise<ToolApprovalStatus> => {
      // The calls answered in this request still run; only a fresh proposal is turned down.
      if (policy.blockNewProposals && !policy.confirmedToolCallIds.has(options.toolCallId)) {
        return { type: 'denied', reason: blockedReason };
      }

      return { type: 'user-approval', reason: await describe(input) };
    };

  return {
    addGroupMember: confirmWith(groups.addGroupMember),
    setGroupMemberRole: confirmWith(groups.setGroupMemberRole),
    moveGroupMember: confirmWith(groups.moveGroupMember),
    removeGroupMember: confirmWith(groups.removeGroupMember),
    createCalendarEvent: confirmWith(calendar.createCalendarEvent),
    updateCalendarEvent: confirmWith(calendar.updateCalendarEvent),
    deleteCalendarEvent: confirmWith(calendar.deleteCalendarEvent),
    createPrayerRequest: confirmWith(prayers.createPrayerRequest),
  } satisfies Partial<Record<AiAssistantToolName, unknown>>;
}

/**
 * Owner-only tools are not offered to anyone else at all. Their calls are refused anyway, but a
 * model that never sees the tool cannot be talked into trying it, and does not spend a step on it.
 */
export function isToolOfferedTo(meta: AiToolMeta, role: OrganizationRole | null): boolean {
  return !meta.policy.ownerRequired || role === 'OWNER';
}

export function toolsInGroups(
  groups: readonly AiToolGroup[],
  role: OrganizationRole | null,
): (keyof AiToolSet)[] {
  const active = new Set<AiToolGroup>(['core', ...groups]);

  return Object.values(AI_TOOL_META)
    .filter((meta) => active.has(meta.group) && isToolOfferedTo(meta, role))
    .map((meta) => meta.name);
}

export function toolGroupOf(toolName: string): AiToolGroup | null {
  return Object.values(AI_TOOL_META).find((meta) => meta.name === toolName)?.group ?? null;
}
