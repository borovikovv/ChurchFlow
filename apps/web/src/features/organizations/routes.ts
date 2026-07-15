import type { Route } from 'next';

export const ORGANIZATION_ROUTE_SEGMENTS = {
  dashboard: 'dashboard',
  calendar: 'calendar',
  budget: 'budget',
  members: 'members',
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

export function organizationCalendarRoute(organizationId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}/${ORGANIZATION_ROUTE_SEGMENTS.calendar}` as Route;
}

export function organizationBudgetRoute(organizationId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}/${ORGANIZATION_ROUTE_SEGMENTS.budget}` as Route;
}

export function organizationProfileRoute(organizationId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}/${ORGANIZATION_ROUTE_SEGMENTS.profile}` as Route;
}

export function organizationProfileNotificationsRoute(organizationId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}/${ORGANIZATION_ROUTE_SEGMENTS.profile}/notifications` as Route;
}

export function organizationWebsiteRoute(organizationId: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.dashboard}/${organizationId}/${ORGANIZATION_ROUTE_SEGMENTS.website}` as Route;
}

export function publicOrganizationRoute(slug: string): Route {
  return `/${ORGANIZATION_ROUTE_SEGMENTS.publicOrganization}/${slug}` as Route;
}
