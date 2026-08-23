'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isNavPathActive } from '@/lib/nav-active';

export function SidebarNavLink({
  href,
  children,
  exact = false,
  activePrefixes = [],
}: {
  href: string;
  children: ReactNode;
  exact?: boolean;
  activePrefixes?: string[];
}) {
  const pathname = usePathname();
  const active =
    isNavPathActive(pathname, href, exact) ||
    activePrefixes.some((prefix) => isNavPathActive(pathname, prefix));

  return (
    <Link className={active ? 'sidebar-link active' : 'sidebar-link'} href={href as Route}>
      {children}
    </Link>
  );
}
