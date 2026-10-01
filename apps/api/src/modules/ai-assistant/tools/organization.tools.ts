import { tool } from 'ai';
import { z } from 'zod';
import { AI_ASSISTANT_TOOL_NAMES } from '@churchflow/shared';
import type { CalendarEventsService } from '../../calendar-events/calendar-events.service';
import type { GroupsService } from '../../groups/groups.service';
import type { MembershipsService } from '../../memberships/memberships.service';
import type { PrayerRequestsService } from '../../prayer-requests/prayer-requests.service';
import { AI_TOOL_GROUPS, jsonInput, localized, type AiToolMeta } from './ai-tool';
import type { AiToolRunner } from './ai-tool-runner';

const SUMMARY_UPCOMING_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const ORGANIZATION_TOOL_META = {
  enableToolGroups: {
    name: 'enableToolGroups',
    group: 'core',
    risk: 'READ',
    policy: {},
    route: null,
  },
  organizationSummary: {
    name: 'organizationSummary',
    group: 'core',
    risk: 'READ',
    policy: {},
    route: null,
  },
} satisfies Record<string, AiToolMeta>;

export const enableToolGroupsInputSchema = z.object({
  groups: z.array(z.enum(AI_TOOL_GROUPS)).min(1),
});

export function organizationTools(
  runner: AiToolRunner,
  services: {
    membershipsService: MembershipsService;
    groupsService: GroupsService;
    calendarEventsService: CalendarEventsService;
    prayerRequestsService: PrayerRequestsService;
  },
) {
  const { organizationId, userId, locale, now } = runner.context;

  return {
    enableToolGroups: tool({
      description: `Load more tools when the current ones cannot answer the request. Groups: members (profiles), groups (groups and their members), calendar (events, services, preachers), prayers (prayer requests), budget (read-only church budget, owner only), knowledge (the church knowledge base: notes on its traditions, instructions and agreements, and its yearly important dates). Tool names: ${AI_ASSISTANT_TOOL_NAMES.join(', ')}.`,
      inputSchema: enableToolGroupsInputSchema,
      execute: (input) => ({
        ok: true as const,
        summary: `Enabled: ${input.groups.join(', ')}.`,
        links: [],
      }),
    }),
    organizationSummary: tool({
      description:
        'Basic numbers about the organization: active members, groups, services and events in the next 7 days, active prayer requests.',
      inputSchema: z.object({}),
      execute: (input, { toolCallId }) =>
        runner.read(
          ORGANIZATION_TOOL_META.organizationSummary,
          toolCallId,
          jsonInput(input),
          async () => {
            const [members, groups, calendar, prayers] = await Promise.all([
              services.membershipsService.listForOrganization(
                organizationId,
                userId,
                'all',
                'active',
                'all',
                '',
                [],
                1,
                10,
              ),
              services.groupsService.listForOrganization(organizationId, userId),
              services.calendarEventsService.listForOrganization(organizationId, userId, {
                rangeStart: now.toISOString(),
                rangeEnd: new Date(now.getTime() + SUMMARY_UPCOMING_DAYS * DAY_MS).toISOString(),
                types: ['SERVICE', 'EVENT'],
              }),
              services.prayerRequestsService.listForOrganization(organizationId, userId, {
                tab: 'active',
                page: 1,
                pageSize: 10,
              }),
            ]);
            const upcomingServices = calendar.events.filter(
              (event) => event.type === 'SERVICE',
            ).length;

            return {
              ok: true,
              summary: localized(locale, {
                en: `${String(members.counts.active)} active members, ${String(groups.groups.length)} groups.`,
                uk: `Активних учасників: ${String(members.counts.active)}, груп: ${String(groups.groups.length)}.`,
              }),
              links: [],
              data: {
                activeMembers: members.counts.active,
                archivedMembers: members.counts.archived,
                groups: groups.groups.length,
                servicesNext7Days: upcomingServices,
                eventsNext7Days: calendar.events.length - upcomingServices,
                activePrayerRequests: prayers.counts.active,
              },
            };
          },
        ),
    }),
  };
}
