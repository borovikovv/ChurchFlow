'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { LogoutButton } from '@/components/logout-button';
import { SidebarNavLink } from '@/components/sidebar-nav-link';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { APP_ROUTES } from '@/routes';
import {
  ORGANIZATION_ROUTE_SEGMENTS,
  organizationCalendarRoute,
  organizationHomeRoute,
  organizationMembersRoute,
  organizationProfileRoute,
  organizationWebsiteRoute,
} from '@/features/organizations/routes';

function getDashboardOrgId(pathname: string): string | null {
  const [, section, orgId] = pathname.split('/');

  return section === ORGANIZATION_ROUTE_SEGMENTS.dashboard && orgId ? orgId : null;
}

export function AppShell({
  children,
  canOpenAdmin,
  displayName,
  websiteOrganizationIds,
}: {
  children: ReactNode;
  canOpenAdmin: boolean;
  displayName: string;
  websiteOrganizationIds: string[];
}) {
  const pathname = usePathname();
  if (pathname === '/o' || pathname.startsWith('/o/')) {
    return <>{children}</>;
  }

  const dashboardOrgId = getDashboardOrgId(pathname);
  const canOpenWebsite = dashboardOrgId ? websiteOrganizationIds.includes(dashboardOrgId) : false;

  return (
    <div className="app-frame">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href={APP_ROUTES.home}>
            <Image src="/icons/church-flow.svg" alt="ChurchFlow" width={60} height={40} priority />
          </Link>
          {canOpenAdmin || dashboardOrgId ? (
            <nav className="site-nav" aria-label="Account navigation">
              {dashboardOrgId ? <NotificationBell organizationId={dashboardOrgId} /> : null}
              {canOpenAdmin ? <Link href={APP_ROUTES.adminOrganizations}>Admin</Link> : null}
            </nav>
          ) : null}
        </div>
      </header>
      <div className="app-shell">
        <aside className="app-sidebar">
          <nav className="sidebar-navigation" aria-label="Application navigation">
            {dashboardOrgId ? (
              <>
                <SidebarNavLink exact href={organizationHomeRoute(dashboardOrgId)}>
                  Home
                </SidebarNavLink>
                <SidebarNavLink href={organizationMembersRoute(dashboardOrgId)}>
                  Members
                </SidebarNavLink>
                <SidebarNavLink href={organizationCalendarRoute(dashboardOrgId)}>
                  Calendar
                </SidebarNavLink>
                <SidebarNavLink href={organizationProfileRoute(dashboardOrgId)}>
                  Profile
                </SidebarNavLink>
                {canOpenWebsite ? (
                  <SidebarNavLink href={organizationWebsiteRoute(dashboardOrgId)}>
                    Website
                  </SidebarNavLink>
                ) : null}
              </>
            ) : canOpenAdmin ? (
              <SidebarNavLink href={APP_ROUTES.organizationRequest}>
                Create organization
              </SidebarNavLink>
            ) : null}
          </nav>

          <div className="sidebar-account">
            <span className="sidebar-account-label">Signed in as</span>
            <div className="sidebar-account-row">
              <strong title={displayName}>{displayName}</strong>
              <LogoutButton />
            </div>
          </div>
        </aside>
        <div className="app-main">{children}</div>
      </div>
    </div>
  );
}
