import { tool } from 'ai';
import { z } from 'zod';
import {
  ENTITLEMENTS,
  ORG_PERMISSIONS,
  ORGANIZATION_GROUP_MEMBER_ROLES,
  addOrganizationGroupMembersSchema,
  moveOrganizationGroupMemberSchema,
  updateOrganizationGroupMemberSchema,
  type OrganizationGroupDetail,
} from '@churchflow/shared';
import { GroupsController } from '../../groups/groups.controller';
import type { GroupsService } from '../../groups/groups.service';
import { jsonInput, localized, type AiToolMeta } from './ai-tool';
import type { AiNameResolver } from './ai-name-resolver';
import type { AiToolRunner } from './ai-tool-runner';

export const GROUPS_TOOL_META = {
  listGroups: {
    name: 'listGroups',
    group: 'groups',
    risk: 'READ',
    policy: {},
    route: { controller: GroupsController, handler: 'list' },
  },
  getGroup: {
    name: 'getGroup',
    group: 'groups',
    risk: 'READ',
    policy: {},
    route: { controller: GroupsController, handler: 'findById' },
  },
  addGroupMember: {
    name: 'addGroupMember',
    group: 'groups',
    risk: 'WRITE',
    policy: { permission: ORG_PERMISSIONS.membersManage, entitlement: ENTITLEMENTS.membersWrite },
    route: { controller: GroupsController, handler: 'addMembers' },
  },
  setGroupMemberRole: {
    name: 'setGroupMemberRole',
    group: 'groups',
    risk: 'WRITE',
    policy: { permission: ORG_PERMISSIONS.membersManage, entitlement: ENTITLEMENTS.membersWrite },
    route: { controller: GroupsController, handler: 'updateMember' },
  },
  moveGroupMember: {
    name: 'moveGroupMember',
    group: 'groups',
    risk: 'WRITE',
    policy: { permission: ORG_PERMISSIONS.membersManage, entitlement: ENTITLEMENTS.membersWrite },
    route: { controller: GroupsController, handler: 'moveMember' },
  },
  removeGroupMember: {
    name: 'removeGroupMember',
    group: 'groups',
    risk: 'DESTRUCTIVE',
    policy: { permission: ORG_PERMISSIONS.membersManage, entitlement: ENTITLEMENTS.membersWrite },
    route: { controller: GroupsController, handler: 'removeMember' },
  },
} satisfies Record<string, AiToolMeta>;

const groupRoleSchema = z.enum(ORGANIZATION_GROUP_MEMBER_ROLES);

export const addGroupMemberInputSchema = z.object({
  groupId: z.string().uuid(),
  membershipId: z.string().uuid(),
  role: groupRoleSchema.default('MEMBER'),
});

export const setGroupMemberRoleInputSchema = z.object({
  groupId: z.string().uuid(),
  membershipId: z.string().uuid(),
  role: groupRoleSchema.describe('LEADER to make the person a group leader, MEMBER to demote.'),
});

export const moveGroupMemberInputSchema = z.object({
  sourceGroupId: z.string().uuid(),
  targetGroupId: z.string().uuid(),
  membershipId: z.string().uuid(),
  role: groupRoleSchema.default('MEMBER'),
});

export const removeGroupMemberInputSchema = z.object({
  groupId: z.string().uuid(),
  membershipId: z.string().uuid(),
});

function memberNameIn(group: OrganizationGroupDetail, membershipId: string): string {
  return group.members.find((member) => member.membershipId === membershipId)?.displayName ?? '';
}

export function groupsTools(runner: AiToolRunner, groupsService: GroupsService) {
  const { organizationId, userId, locale } = runner.context;

  return {
    listGroups: tool({
      description:
        'List the groups of the organization with their groupId, member count and leaders. Use it to turn a group name into a groupId.',
      inputSchema: z.object({}),
      execute: (input, { toolCallId }) =>
        runner.read(GROUPS_TOOL_META.listGroups, toolCallId, jsonInput(input), async () => {
          const { groups } = await groupsService.listForOrganization(organizationId, userId);

          return {
            ok: true,
            summary: localized(locale, {
              en: `${String(groups.length)} groups.`,
              uk: `Груп: ${String(groups.length)}.`,
            }),
            links: [],
            data: {
              groups: groups.map((group) => ({
                groupId: group.id,
                name: group.name,
                memberCount: group.memberCount,
                leaders: group.leaders.map((leader) => leader.displayName),
              })),
            },
          };
        }),
    }),
    getGroup: tool({
      description: 'Get one group by groupId with every member, their membershipId and group role.',
      inputSchema: z.object({ groupId: z.string().uuid() }),
      execute: (input, { toolCallId }) =>
        runner.read(GROUPS_TOOL_META.getGroup, toolCallId, jsonInput(input), async () => {
          const { group } = await groupsService.findById(organizationId, input.groupId, userId);

          return {
            ok: true,
            summary: localized(locale, {
              en: `${group.name}: ${String(group.members.length)} members.`,
              uk: `${group.name}: ${String(group.members.length)} учасників.`,
            }),
            links: [{ kind: 'group', id: group.id, label: group.name }],
            data: {
              groupId: group.id,
              name: group.name,
              description: group.description,
              members: group.members.map((member) => ({
                membershipId: member.membershipId,
                displayName: member.displayName,
                role: member.role,
                responsibility: member.responsibility,
              })),
            },
          };
        }),
    }),
    addGroupMember: tool({
      description:
        'Add one person to a group. Requires confirmation by the user before it runs. Resolve both ids first with searchMembers and listGroups.',
      inputSchema: addGroupMemberInputSchema,
      execute: (input, { toolCallId }) =>
        runner.mutate(GROUPS_TOOL_META.addGroupMember, toolCallId, async () => {
          const group = await groupsService.addMembers(
            organizationId,
            input.groupId,
            addOrganizationGroupMembersSchema.parse({
              members: [{ membershipId: input.membershipId, role: input.role }],
            }),
            userId,
          );
          const name = memberNameIn(group, input.membershipId);

          return {
            ok: true,
            summary: localized(locale, {
              en: `${name} was added to ${group.name}.`,
              uk: `${name} додано до групи «${group.name}».`,
            }),
            links: [
              { kind: 'group', id: group.id, label: group.name },
              { kind: 'member', id: input.membershipId, label: name },
            ],
          };
        }),
    }),
    setGroupMemberRole: tool({
      description:
        'Make a group member a leader or an ordinary member. Requires confirmation by the user before it runs.',
      inputSchema: setGroupMemberRoleInputSchema,
      execute: (input, { toolCallId }) =>
        runner.mutate(GROUPS_TOOL_META.setGroupMemberRole, toolCallId, async () => {
          const group = await groupsService.updateMember(
            organizationId,
            input.groupId,
            input.membershipId,
            updateOrganizationGroupMemberSchema.parse({ role: input.role }),
            userId,
          );
          const name = memberNameIn(group, input.membershipId);

          return {
            ok: true,
            summary:
              input.role === 'LEADER'
                ? localized(locale, {
                    en: `${name} is now a leader of ${group.name}.`,
                    uk: `${name} тепер лідер групи «${group.name}».`,
                  })
                : localized(locale, {
                    en: `${name} is now a member of ${group.name}.`,
                    uk: `${name} тепер учасник групи «${group.name}».`,
                  }),
            links: [{ kind: 'group', id: group.id, label: group.name }],
          };
        }),
    }),
    moveGroupMember: tool({
      description:
        'Move a person from one group to another. Requires confirmation by the user before it runs.',
      inputSchema: moveGroupMemberInputSchema,
      execute: (input, { toolCallId }) =>
        runner.mutate(GROUPS_TOOL_META.moveGroupMember, toolCallId, async () => {
          const { sourceGroup, targetGroup } = await groupsService.moveMember(
            organizationId,
            input.sourceGroupId,
            input.membershipId,
            moveOrganizationGroupMemberSchema.parse({
              targetGroupId: input.targetGroupId,
              role: input.role,
            }),
            userId,
          );
          const name = memberNameIn(targetGroup, input.membershipId);

          return {
            ok: true,
            summary: localized(locale, {
              en: `${name} was moved from ${sourceGroup.name} to ${targetGroup.name}.`,
              uk: `${name} переміщено з групи «${sourceGroup.name}» до «${targetGroup.name}».`,
            }),
            links: [
              { kind: 'group', id: sourceGroup.id, label: sourceGroup.name },
              { kind: 'group', id: targetGroup.id, label: targetGroup.name },
            ],
          };
        }),
    }),
    removeGroupMember: tool({
      description:
        'Remove a person from a group. Requires confirmation by the user before it runs.',
      inputSchema: removeGroupMemberInputSchema,
      execute: (input, { toolCallId }) =>
        runner.mutate(GROUPS_TOOL_META.removeGroupMember, toolCallId, async () => {
          const group = await groupsService.removeMember(
            organizationId,
            input.groupId,
            input.membershipId,
            userId,
          );

          return {
            ok: true,
            summary: localized(locale, {
              en: `Removed from ${group.name}.`,
              uk: `Вилучено з групи «${group.name}».`,
            }),
            links: [{ kind: 'group', id: group.id, label: group.name }],
          };
        }),
    }),
  };
}

export function groupsApprovalReasons(runner: AiToolRunner, names: AiNameResolver) {
  const { locale } = runner.context;
  const unknown = localized(locale, { en: 'unknown', uk: 'невідомо' });
  const named = async (value: Promise<string | null>) => (await value) ?? unknown;

  return {
    addGroupMember: async (input: z.infer<typeof addGroupMemberInputSchema>) => {
      const [member, group] = await Promise.all([
        named(names.memberName(input.membershipId)),
        named(names.groupName(input.groupId)),
      ]);
      return input.role === 'LEADER'
        ? localized(locale, {
            en: `Add ${member} to ${group} as a leader.`,
            uk: `Додати ${member} до групи «${group}» як лідера.`,
          })
        : localized(locale, {
            en: `Add ${member} to ${group}.`,
            uk: `Додати ${member} до групи «${group}».`,
          });
    },
    setGroupMemberRole: async (input: z.infer<typeof setGroupMemberRoleInputSchema>) => {
      const [member, group] = await Promise.all([
        named(names.memberName(input.membershipId)),
        named(names.groupName(input.groupId)),
      ]);
      return input.role === 'LEADER'
        ? localized(locale, {
            en: `Make ${member} a leader of ${group}.`,
            uk: `Зробити ${member} лідером групи «${group}».`,
          })
        : localized(locale, {
            en: `Make ${member} an ordinary member of ${group}.`,
            uk: `Зробити ${member} звичайним учасником групи «${group}».`,
          });
    },
    moveGroupMember: async (input: z.infer<typeof moveGroupMemberInputSchema>) => {
      const [member, source, target] = await Promise.all([
        named(names.memberName(input.membershipId)),
        named(names.groupName(input.sourceGroupId)),
        named(names.groupName(input.targetGroupId)),
      ]);
      return input.role === 'LEADER'
        ? localized(locale, {
            en: `Move ${member} from ${source} to ${target} as a leader.`,
            uk: `Перемістити ${member} з групи «${source}» до «${target}» як лідера.`,
          })
        : localized(locale, {
            en: `Move ${member} from ${source} to ${target}.`,
            uk: `Перемістити ${member} з групи «${source}» до «${target}».`,
          });
    },
    removeGroupMember: async (input: z.infer<typeof removeGroupMemberInputSchema>) => {
      const [member, group] = await Promise.all([
        named(names.memberName(input.membershipId)),
        named(names.groupName(input.groupId)),
      ]);
      return localized(locale, {
        en: `Remove ${member} from ${group}.`,
        uk: `Вилучити ${member} з групи «${group}».`,
      });
    },
  };
}
