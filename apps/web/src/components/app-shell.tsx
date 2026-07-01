import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoutButton } from '@/components/logout-button';
import { SidebarNavLink } from '@/components/sidebar-nav-link';

export function AppShell({
  children,
  isPlatformAdmin,
  displayName,
}: {
  children: ReactNode;
  isPlatformAdmin: boolean;
  displayName: string;
}) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="sidebar-brand flex justify-center" href="/">
          <Image src="/icons/church-flow.svg" alt="ChurchFlow" width={52} height={36} priority />
        </Link>

        <nav className="sidebar-navigation" aria-label="Application navigation">
          {isPlatformAdmin ? (
            <SidebarNavLink href="/admin/organizations">Organizations</SidebarNavLink>
          ) : null}
          <SidebarNavLink href="/organization-request/status" activePrefixes={['/dashboard']}>
            My requests
          </SidebarNavLink>
          <SidebarNavLink href="/profile">Profile</SidebarNavLink>
        </nav>

        <div className="sidebar-account">
          <span className="sidebar-account-label">Signed in as</span>
          <strong title={displayName}>{displayName}</strong>
          <LogoutButton />
        </div>
      </aside>
      <div className="app-main">{children}</div>
    </div>
  );
}
