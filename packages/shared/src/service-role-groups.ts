import {
  CALENDAR_SERVICE_ROLE_FALLBACK_GROUP_ICONS,
  CALENDAR_SERVICE_ROLES,
  ORGANIZATION_GROUP_ICON_SERVICE_ROLES,
} from './constants.js';
import type {
  CalendarServiceRole,
  OrganizationGroupBadge,
  OrganizationGroupIcon,
  OrganizationGroupMemberRole,
  ServiceRoleGroups,
} from './types.js';

export interface ServiceRoleCandidate {
  displayName: string;
  groups: Array<OrganizationGroupBadge & { role?: OrganizationGroupMemberRole }>;
}

/** One block of a service role select. `group` is null for the people outside linked groups. */
export interface ServiceRoleCandidateSection<T extends ServiceRoleCandidate> {
  group: OrganizationGroupBadge | null;
  members: T[];
}

export function emptyServiceRoleGroups(): ServiceRoleGroups {
  return Object.fromEntries(
    CALENDAR_SERVICE_ROLES.map((role) => [role, [] as string[]]),
  ) as ServiceRoleGroups;
}

/** Builds the per-role lists from link rows already sorted by role position. */
export function serviceRoleGroupsFromLinks(
  links: ReadonlyArray<{ role: CalendarServiceRole; groupId: string }>,
): ServiceRoleGroups {
  const roles = emptyServiceRoleGroups();
  for (const link of links) roles[link.role].push(link.groupId);

  return roles;
}

/** The roles the group form ticks for a new group drawn with this icon. */
export function defaultServiceRolesForIcon(icon: OrganizationGroupIcon): CalendarServiceRole[] {
  return [...(ORGANIZATION_GROUP_ICON_SERVICE_ROLES[icon] ?? [])];
}

/**
 * Splits people into the blocks a service role select shows.
 *
 * With linked groups: one block per linked group that has members, in link order, leaders first
 * and then by name; a person in several linked groups appears once, in the first. Everyone else
 * follows in one block by name, so a stand-in outside the groups can still be picked.
 *
 * Without linked groups: one block, people from groups with the role's fallback icons first (in
 * icon order), then the rest, each part by name. This is how every role worked before groups
 * could be linked.
 */
export function serviceRoleCandidateSections<T extends ServiceRoleCandidate>(
  members: readonly T[],
  role: CalendarServiceRole,
  serviceRoleGroups: ServiceRoleGroups | undefined,
): Array<ServiceRoleCandidateSection<T>> {
  const linkedGroupIds = serviceRoleGroups?.[role] ?? [];
  if (linkedGroupIds.length === 0) {
    return [{ group: null, members: sortByFallbackIcons(members, role) }];
  }

  const placed = new Set<T>();
  const sections: Array<ServiceRoleCandidateSection<T>> = [];
  for (const groupId of linkedGroupIds) {
    const inGroup = members.filter(
      (member) => !placed.has(member) && member.groups.some((group) => group.id === groupId),
    );
    if (inGroup.length === 0) continue;

    const group = inGroup[0]?.groups.find((candidate) => candidate.id === groupId);
    if (!group) continue;

    inGroup.forEach((member) => placed.add(member));
    sections.push({
      group: { id: group.id, name: group.name, icon: group.icon, color: group.color },
      members: [...inGroup].sort(
        (left, right) =>
          leaderRank(left, groupId) - leaderRank(right, groupId) || byName(left, right),
      ),
    });
  }

  const others = members.filter((member) => !placed.has(member)).sort(byName);
  if (sections.length === 0) return [{ group: null, members: others }];
  if (others.length > 0) sections.push({ group: null, members: others });

  return sections;
}

/**
 * The groups whose members are candidates for a role: the linked groups, or while none is linked,
 * the groups drawn with one of the role's fallback icons.
 */
export function serviceRoleCandidateGroupIds(
  role: CalendarServiceRole,
  groups: ReadonlyArray<{
    id: string;
    icon: OrganizationGroupIcon;
    serviceRoles: CalendarServiceRole[];
  }>,
): string[] {
  const linked = groups.filter((group) => group.serviceRoles.includes(role));
  if (linked.length > 0) return linked.map((group) => group.id);

  const icons: readonly OrganizationGroupIcon[] = CALENDAR_SERVICE_ROLE_FALLBACK_GROUP_ICONS[role];
  return groups.filter((group) => icons.includes(group.icon)).map((group) => group.id);
}

function sortByFallbackIcons<T extends ServiceRoleCandidate>(
  members: readonly T[],
  role: CalendarServiceRole,
): T[] {
  const icons: readonly OrganizationGroupIcon[] = CALENDAR_SERVICE_ROLE_FALLBACK_GROUP_ICONS[role];
  const rank = (member: T) => {
    const index = icons.findIndex((icon) => member.groups.some((group) => group.icon === icon));
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };

  return [...members].sort((left, right) => rank(left) - rank(right) || byName(left, right));
}

function leaderRank(member: ServiceRoleCandidate, groupId: string): number {
  return member.groups.some((group) => group.id === groupId && group.role === 'LEADER') ? 0 : 1;
}

function byName(left: ServiceRoleCandidate, right: ServiceRoleCandidate): number {
  return left.displayName.localeCompare(right.displayName);
}
