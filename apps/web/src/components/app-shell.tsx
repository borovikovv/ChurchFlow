'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { LogoutButton } from '@/components/logout-button';
import { SidebarNavLink } from '@/components/sidebar-nav-link';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { useCloseOnOutsideClick } from '@/hooks/use-close-on-outside-click';
import { APP_ROUTES } from '@/routes';
import {
  ORGANIZATION_ROUTE_SEGMENTS,
  organizationCalendarRoute,
  organizationBudgetRoute,
  organizationHomeRoute,
  organizationMembersRoute,
  organizationProfileRoute,
  organizationWebsiteRoute,
} from '@/features/organizations/routes';

function getDashboardOrgId(pathname: string): string | null {
  const [, section, orgId] = pathname.split('/');

  return section === ORGANIZATION_ROUTE_SEGMENTS.dashboard && orgId ? orgId : null;
}

interface AppNavItem {
  href: string;
  label: string;
  exact?: boolean;
}

export function AppShell({
  children,
  canOpenAdmin,
  budgetOrganizationIds,
  displayName,
  websiteOrganizationIds,
}: {
  children: ReactNode;
  canOpenAdmin: boolean;
  budgetOrganizationIds: string[];
  displayName: string;
  websiteOrganizationIds: string[];
}) {
  const pathname = usePathname();
  if (pathname === '/o' || pathname.startsWith('/o/')) {
    return <>{children}</>;
  }

  const dashboardOrgId = getDashboardOrgId(pathname);
  const canOpenWebsite = dashboardOrgId ? websiteOrganizationIds.includes(dashboardOrgId) : false;
  const canOpenBudget = dashboardOrgId ? budgetOrganizationIds.includes(dashboardOrgId) : false;
  const navItems = dashboardOrgId
    ? dashboardNavigationItems(dashboardOrgId, { canOpenBudget, canOpenWebsite })
    : canOpenAdmin
      ? [{ href: APP_ROUTES.organizationRequest, label: 'Create organization' }]
      : [];

  return (
    <div className="app-frame">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href={APP_ROUTES.home}>
            <Image src="/icons/church-flow.svg" alt="ChurchFlow" width={60} height={40} priority />
          </Link>
          {canOpenAdmin || dashboardOrgId ? (
            <nav className="site-nav desktop-site-nav" aria-label="Account navigation">
              {dashboardOrgId ? <NotificationBell organizationId={dashboardOrgId} /> : null}
              {canOpenAdmin ? <Link href={APP_ROUTES.adminOrganizations}>Admin</Link> : null}
            </nav>
          ) : null}
          {canOpenAdmin || dashboardOrgId ? (
            <div className="mobile-header-actions">
              <MobileAppMenu
                canOpenAdmin={canOpenAdmin}
                displayName={displayName}
                organizationId={dashboardOrgId}
                navItems={navItems}
              />
            </div>
          ) : null}
        </div>
      </header>
      <div className="app-shell">
        <aside className="app-sidebar">
          <nav className="sidebar-navigation" aria-label="Application navigation">
            {navItems.map((item) => (
              <SidebarNavLink
                {...(item.exact ? { exact: true } : {})}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </SidebarNavLink>
            ))}
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

function MobileAppMenu({
  canOpenAdmin,
  displayName,
  organizationId,
  navItems,
}: {
  canOpenAdmin: boolean;
  displayName: string;
  organizationId: string | null;
  navItems: AppNavItem[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const outsideClickRefs = useMemo(() => [containerRef], []);

  const close = useCallback(() => setOpen(false), []);

  useCloseOnOutsideClick({
    enabled: open,
    refs: outsideClickRefs,
    onOutsideClick: close,
  });

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [close, open]);

  return (
    <div className="mobile-app-menu" ref={containerRef}>
      <button
        type="button"
        className="mobile-menu-button"
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      {open ? (
        <section className="mobile-menu-panel" role="dialog" aria-label="Navigation menu">
          {navItems.length > 0 ? (
            <nav className="mobile-menu-nav" aria-label="Application navigation">
              {navItems.map((item) => (
                <Link
                  className={mobileMenuLinkClass(pathname, item)}
                  href={item.href as Route}
                  key={item.href}
                  onClick={close}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}

          <div className="mobile-menu-account">
            <strong title={displayName}>{displayName}</strong>
          </div>

          <div className="mobile-menu-actions">
            {organizationId ? <NotificationBell organizationId={organizationId} /> : null}
            {canOpenAdmin ? (
              <Link
                className="mobile-menu-action-link"
                href={APP_ROUTES.adminOrganizations}
                onClick={close}
              >
                Admin
              </Link>
            ) : null}
            <LogoutButton />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function dashboardNavigationItems(
  organizationId: string,
  access: { canOpenBudget: boolean; canOpenWebsite: boolean },
): AppNavItem[] {
  return [
    { href: organizationHomeRoute(organizationId), label: 'Home', exact: true },
    { href: organizationMembersRoute(organizationId), label: 'Members' },
    { href: organizationCalendarRoute(organizationId), label: 'Calendar' },
    ...(access.canOpenBudget
      ? [{ href: organizationBudgetRoute(organizationId), label: 'Budget' }]
      : []),
    { href: organizationProfileRoute(organizationId), label: 'Profile' },
    ...(access.canOpenWebsite
      ? [{ href: organizationWebsiteRoute(organizationId), label: 'Website' }]
      : []),
  ];
}

function mobileMenuLinkClass(pathname: string, item: AppNavItem): string {
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return active ? 'mobile-menu-link active' : 'mobile-menu-link';
}
