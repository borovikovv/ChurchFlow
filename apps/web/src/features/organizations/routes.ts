import type { Route } from 'next';

export const ORGANIZATION_ROUTE_SEGMENTS = {
  dashboard: 'dashboard',
  calendar: 'calendar',
  budget: 'budget',
  members: 'members',
  groups: 'groups',
  prayerRequests: 'prayer-requests',
  profile: 'profile',
  website: 'website',
  publicOrganization: 'o',
} as const;

export function organizationHomeRoute(organizationId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}` as Route;
}

export function organizationMembersRoute(organizationId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}/${ORGANIZATION_ROUTE_SEGMENTS.members}` as Route;
}

export function organizationMemberRoute(organizationId: string, memberId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}/${ORGANIZATION_ROUTE_SEGMENTS.members}/${memberId}` as Route;
}

export function organizationGroupsRoute(organizationId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}/${ORGANIZATION_ROUTE_SEGMENTS.groups}` as Route;
}

export function organizationGroupRoute(organizationId: string, groupId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}/${ORGANIZATION_ROUTE_SEGMENTS.groups}/${groupId}` as Route;
}

export function organizationCalendarRoute(organizationId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}/${ORGANIZATION_ROUTE_SEGMENTS.calendar}` as Route;
}

export function organizationBudgetRoute(organizationId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}/${ORGANIZATION_ROUTE_SEGMENTS.budget}` as Route;
}

export function organizationPrayerRequestsRoute(organizationId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}/${ORGANIZATION_ROUTE_SEGMENTS.prayerRequests}` as Route;
}

export function organizationProfileRoute(organizationId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}/${ORGANIZATION_ROUTE_SEGMENTS.profile}` as Route;
}

export function organizationProfileNotificationsRoute(organizationId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}/${ORGANIZATION_ROUTE_SEGMENTS.profile}/notifications` as Route;
}

export function organizationProfileSessionsRoute(organizationId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}/${ORGANIZATION_ROUTE_SEGMENTS.profile}/sessions` as Route;
}

export function organizationWebsiteRoute(organizationId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}/${ORGANIZATION_ROUTE_SEGMENTS.website}` as Route;
}

export function publicOrganizationRoute(slug: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.publicOrganization}/${slug}` as Route;
}
