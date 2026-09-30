import { tool } from 'ai';
import { z } from 'zod';
import { MembershipsController } from '../../memberships/memberships.controller';
import type { MembershipsService } from '../../memberships/memberships.service';
import { dateOnly, jsonInput, localized, type AiToolMeta } from './ai-tool';
import type { AiToolRunner } from './ai-tool-runner';

const SEARCH_RESULT_LIMIT = 10;

export const MEMBERS_TOOL_META = {
  searchMembers: {
    name: 'searchMembers',
    group: 'core',
    risk: 'READ',
    policy: {},
    route: { controller: MembershipsController, handler: 'list' },
  },
  getMember: {
    name: 'getMember',
    group: 'members',
    risk: 'READ',
    policy: {},
    route: { controller: MembershipsController, handler: 'list' },
  },
} satisfies Record<string, AiToolMeta>;

export function membersTools(runner: AiToolRunner, membershipsService: MembershipsService) {
  const { organizationId, userId, locale } = runner.context;

  return {
    searchMembers: tool({
      description:
        'Find people in the organization by name. Returns up to 10 matches with their membershipId. Always use it to turn a name into a membershipId before acting on a person. If more than one person matches, ask the user which one they mean instead of guessing.',
      inputSchema: z.object({
        query: z.string().trim().min(1).max(100).describe('A full or partial name.'),
      }),
      execute: (input, { toolCallId }) =>
        runner.read(MEMBERS_TOOL_META.searchMembers, toolCallId, jsonInput(input), async () => {
          const result = await membershipsService.listForOrganization(
            organizationId,
            userId,
            'all',
            'active',
            'all',
            input.query,
            [],
            1,
            SEARCH_RESULT_LIMIT,
          );
          const members = result.members.map((member) => ({
            membershipId: member.id,
            displayName: member.profile.displayName,
            role: member.role,
            groups: member.groups.map((group) => group.name),
          }));

          return {
            ok: true,
            summary: localized(locale, {
              en: `Found ${String(members.length)} of ${String(result.pagination.total)} matching people.`,
              uk: `Знайдено ${String(members.length)} з ${String(result.pagination.total)} людей.`,
            }),
            links: members.map((member) => ({
              kind: 'member',
              id: member.membershipId,
              label: member.displayName,
            })),
            data: { total: result.pagination.total, members },
          };
        }),
    }),
    getMember: tool({
      description:
        'Get the profile of one person by membershipId: role, contacts, dates and groups. Only fields the requesting user may see are returned.',
      inputSchema: z.object({ membershipId: z.string().uuid() }),
      execute: (input, { toolCallId }) =>
        runner.read(MEMBERS_TOOL_META.getMember, toolCallId, jsonInput(input), async () => {
          const result = await membershipsService.listForOrganization(
            organizationId,
            userId,
            'all',
            'active',
            'all',
            '',
            [],
            1,
            SEARCH_RESULT_LIMIT,
            input.membershipId,
          );
          const member = result.members.find((candidate) => candidate.id === input.membershipId);
          if (!member) {
            return {
              ok: false,
              error: localized(locale, {
                en: 'This person was not found in the organization.',
                uk: 'Цю людину не знайдено в організації.',
              }),
            };
          }

          const { profile } = member;
          return {
            ok: true,
            summary: profile.displayName,
            links: [{ kind: 'member', id: member.id, label: profile.displayName }],
            data: {
              membershipId: member.id,
              displayName: profile.displayName,
              role: member.role,
              status: member.status,
              email: profile.email,
              phone: profile.phone,
              birthday: dateOnly(profile.birthday),
              anniversary: dateOnly(profile.anniversary),
              memberSince: dateOnly(profile.memberSince),
              groups: member.groups.map((group) => ({ groupId: group.id, name: group.name })),
            },
          };
        }),
    }),
  };
}
