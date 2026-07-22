'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
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
  const t = useTranslations('navigation');
  const commonT = useTranslations('common');
  if (pathname === '/o' || pathname.startsWith('/o/')) {
    return <>{children}</>;
  }

  const dashboardOrgId = getDashboardOrgId(pathname);
  const canOpenWebsite = dashboardOrgId ? websiteOrganizationIds.includes(dashboardOrgId) : false;
  const canOpenBudget = dashboardOrgId ? budgetOrganizationIds.includes(dashboardOrgId) : false;
  const navItems = dashboardOrgId
    ? dashboardNavigationItems(dashboardOrgId, {
        canOpenBudget,
        canOpenWebsite,
        labels: {
          budget: t('budget'),
          calendar: t('calendar'),
          home: t('home'),
          members: t('members'),
          profile: t('profile'),
          website: t('website'),
        },
      })
    : canOpenAdmin
      ? [{ href: APP_ROUTES.organizationRequest, label: t('createOrganization') }]
      : [];

  return (
    <div className="app-frame">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href={APP_ROUTES.home}>
            <Image src="/icons/church-flow.svg" alt="ChurchFlow" width={60} height={40} priority />
          </Link>
          {canOpenAdmin || dashboardOrgId ? (
            <nav className="site-nav desktop-site-nav" aria-label={t('accountNavigation')}>
              {dashboardOrgId ? <NotificationBell organizationId={dashboardOrgId} /> : null}
              {canOpenAdmin ? (
                <Link href={APP_ROUTES.adminOrganizations}>{commonT('admin')}</Link>
              ) : null}
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
          <nav className="sidebar-navigation" aria-label={t('applicationNavigation')}>
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
            <span className="sidebar-account-label">{t('signedInAs')}</span>
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
  const t = useTranslations('navigation');
  const commonT = useTranslations('common');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const outsideClickRefs = useMemo(() => [containerRef], []);

  const close = useCallback(() => setOpen(false), []);

  useCloseOnOutsideClick({
    closeOnEscape: true,
    enabled: open,
    refs: outsideClickRefs,
    onOutsideClick: close,
  });

  return (
    <div className="mobile-app-menu" ref={containerRef}>
      <button
        type="button"
        className="mobile-menu-button"
        aria-label={t('openNavigationMenu')}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      {open ? (
        <section className="mobile-menu-panel" role="dialog" aria-label={t('navigationMenu')}>
          {navItems.length > 0 ? (
            <nav className="mobile-menu-nav" aria-label={t('applicationNavigation')}>
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
                {commonT('admin')}
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
  access: {
    canOpenBudget: boolean;
    canOpenWebsite: boolean;
    labels: {
      budget: string;
      calendar: string;
      home: string;
      members: string;
      profile: string;
      website: string;
    };
  },
): AppNavItem[] {
  return [
    { href: organizationHomeRoute(organizationId), label: access.labels.home, exact: true },
    { href: organizationProfileRoute(organizationId), label: access.labels.profile },
    { href: organizationMembersRoute(organizationId), label: access.labels.members },
    { href: organizationCalendarRoute(organizationId), label: access.labels.calendar },
    ...(access.canOpenBudget
      ? [{ href: organizationBudgetRoute(organizationId), label: access.labels.budget }]
      : []),
    ...(access.canOpenWebsite
      ? [{ href: organizationWebsiteRoute(organizationId), label: access.labels.website }]
      : []),
  ];
}

function mobileMenuLinkClass(pathname: string, item: AppNavItem): string {
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return active ? 'mobile-menu-link active' : 'mobile-menu-link';
}
