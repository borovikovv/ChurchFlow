import type { Route } from 'next';
import type { AiAssistantEntityLink } from '@churchflow/shared';
import {
  organizationBudgetRoute,
  organizationCalendarRoute,
  organizationGroupRoute,
  organizationGroupsRoute,
  organizationMemberRoute,
  organizationMembersRoute,
  organizationPrayerRequestsRoute,
} from '@/features/organizations/routes';

export function aiAssistantEntityLinkRoute(
  organizationId: string,
  link: AiAssistantEntityLink,
): Route {
  switch (link.kind) {
    case 'member':
      return link.id
        ? organizationMemberRoute(organizationId, link.id)
        : organizationMembersRoute(organizationId);
    case 'group':
      return link.id
        ? organizationGroupRoute(organizationId, link.id)
        : organizationGroupsRoute(organizationId);
    case 'calendar':
      return organizationCalendarRoute(organizationId);
    case 'prayerRequests':
      return organizationPrayerRequestsRoute(organizationId);
    case 'budget':
      return organizationBudgetRoute(organizationId);
  }
}
