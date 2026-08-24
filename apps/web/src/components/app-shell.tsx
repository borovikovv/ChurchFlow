'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { dashboardNavigationItems, type AppNavItem } from '@/components/app-navigation';
import { PlusIcon } from '@/components/icons/action-icons';
import { AdminIcon } from '@/components/icons/navigation-icons';
import { LogoutButton } from '@/components/logout-button';
import { MobileTabBar } from '@/components/mobile-tab-bar';
import { SidebarNavLink } from '@/components/sidebar-nav-link';
import { UserMenu } from '@/components/user-menu';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { navItemsInGroup } from '@/lib/nav-groups';
import { APP_ROUTES } from '@/routes';
import { ORGANIZATION_ROUTE_SEGMENTS } from '@/features/organizations/routes';

interface AppShellProps {
  children: ReactNode;
  avatarUrl: string | null;
  canOpenAdmin: boolean;
  budgetOrganizationIds: string[];
  displayName: string;
  websiteOrganizationIds: string[];
}

function getDashboardOrgId(pathname: string): string | null {
  const [, section, orgId] = pathname.split('/');

  return section === ORGANIZATION_ROUTE_SEGMENTS.dashboard && orgId ? orgId : null;
}

function usesPlainShell(pathname: string): boolean {
  return pathname === '/offline' || pathname === '/o' || pathname.startsWith('/o/');
}

export function AppShell({
  children,
  avatarUrl,
  canOpenAdmin,
  budgetOrganizationIds,
  displayName,
  websiteOrganizationIds,
}: AppShellProps) {
  const pathname = usePathname();
  const t = useTranslations('navigation');
  const commonT = useTranslations('common');
  if (usesPlainShell(pathname)) {
    return <>{children}</>;
  }

  const dashboardOrgId = getDashboardOrgId(pathname);
  const showAccountNavigation = canOpenAdmin || Boolean(dashboardOrgId);
  const canOpenWebsite = dashboardOrgId ? websiteOrganizationIds.includes(dashboardOrgId) : false;
  const canOpenBudget = dashboardOrgId ? budgetOrganizationIds.includes(dashboardOrgId) : false;
  const navItems: AppNavItem[] = dashboardOrgId
    ? dashboardNavigationItems(dashboardOrgId, {
        canOpenBudget,
        canOpenWebsite,
        descriptions: {
          budget: t('descriptions.budget'),
          prayerRequests: t('descriptions.prayerRequests'),
          profile: t('descriptions.profile'),
          website: t('descriptions.website'),
        },
        labels: {
          budget: t('budget'),
          calendar: t('calendar'),
          home: t('home'),
          members: t('members'),
          prayerRequests: t('prayerRequests'),
          profile: t('profile'),
          website: t('website'),
        },
      })
    : canOpenAdmin
      ? [
          {
            href: APP_ROUTES.organizationRequest,
            label: t('createOrganization'),
            icon: PlusIcon,
            group: 'account' as const,
          },
        ]
      : [];

  const accountMenuItems: AppNavItem[] = [
    ...navItemsInGroup(navItems, 'account'),
    ...(canOpenAdmin
      ? [
          {
            href: APP_ROUTES.adminOrganizations,
            label: commonT('admin'),
            icon: AdminIcon,
            group: 'account' as const,
          },
        ]
      : []),
  ];

  return (
    <div className="app-frame">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href={APP_ROUTES.home}>
            <Image src="/icons/church-flow.svg" alt="ChurchFlow" width={60} height={40} priority />
          </Link>
          {showAccountNavigation ? (
            <nav className="site-nav" aria-label={t('accountNavigation')}>
              {dashboardOrgId ? <NotificationBell organizationId={dashboardOrgId} /> : null}
              {canOpenAdmin ? (
                <div className="desktop-site-nav">
                  <Link href={APP_ROUTES.adminOrganizations}>{commonT('admin')}</Link>
                </div>
              ) : null}
              <div className="mobile-header-actions">
                <UserMenu
                  avatarUrl={avatarUrl}
                  displayName={displayName}
                  items={accountMenuItems}
                />
              </div>
            </nav>
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
        <div className={dashboardOrgId ? 'app-main with-tab-bar' : 'app-main'}>{children}</div>
      </div>
      {dashboardOrgId ? <MobileTabBar items={navItems} /> : null}
    </div>
  );
}
