import type { Route } from 'next';
import type { ComponentType } from 'react';
import type { IconProps } from '@/components/icons/icon';
import type { AppNavGroup } from '@/lib/nav-groups';
import {
  BudgetIcon,
  CalendarIcon,
  HomeIcon,
  MembersIcon,
  PrayerIcon,
  ProfileIcon,
  WebsiteIcon,
} from '@/components/icons/navigation-icons';
import {
  organizationBudgetRoute,
  organizationCalendarRoute,
  organizationHomeRoute,
  organizationMembersRoute,
  organizationPrayerRequestsRoute,
  organizationProfileRoute,
  organizationWebsiteRoute,
} from '@/features/organizations/routes';

export interface AppNavItem {
  href: Route;
  label: string;
  description?: string | undefined;
  icon: ComponentType<IconProps>;
  group: AppNavGroup;
  exact?: boolean | undefined;
}

export interface DashboardNavigationLabels {
  budget: string;
  calendar: string;
  home: string;
  members: string;
  prayerRequests: string;
  profile: string;
  website: string;
}

export interface DashboardNavigationDescriptions {
  budget: string;
  prayerRequests: string;
  profile: string;
  website: string;
}

export interface DashboardNavigationAccess {
  canOpenBudget: boolean;
  canOpenWebsite: boolean;
  descriptions: DashboardNavigationDescriptions;
  labels: DashboardNavigationLabels;
}

export function dashboardNavigationItems(
  organizationId: string,
  access: DashboardNavigationAccess,
): AppNavItem[] {
  return [
    {
      href: organizationHomeRoute(organizationId),
      label: access.labels.home,
      icon: HomeIcon,
      group: 'primary',
      exact: true,
    },
    {
      href: organizationProfileRoute(organizationId),
      label: access.labels.profile,
      description: access.descriptions.profile,
      icon: ProfileIcon,
      group: 'account',
    },
    {
      href: organizationMembersRoute(organizationId),
      label: access.labels.members,
      icon: MembersIcon,
      group: 'primary',
    },
    {
      href: organizationCalendarRoute(organizationId),
      label: access.labels.calendar,
      icon: CalendarIcon,
      group: 'primary',
    },
    {
      href: organizationPrayerRequestsRoute(organizationId),
      label: access.labels.prayerRequests,
      description: access.descriptions.prayerRequests,
      icon: PrayerIcon,
      group: 'more',
    },
    ...(access.canOpenBudget
      ? [
          {
            href: organizationBudgetRoute(organizationId),
            label: access.labels.budget,
            description: access.descriptions.budget,
            icon: BudgetIcon,
            group: 'more' as const,
          },
        ]
      : []),
    ...(access.canOpenWebsite
      ? [
          {
            href: organizationWebsiteRoute(organizationId),
            label: access.labels.website,
            description: access.descriptions.website,
            icon: WebsiteIcon,
            group: 'more' as const,
          },
        ]
      : []),
  ];
}
