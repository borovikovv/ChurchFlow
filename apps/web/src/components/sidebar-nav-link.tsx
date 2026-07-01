'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

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
  const hrefIsActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
  const prefixIsActive = activePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const active = hrefIsActive || prefixIsActive;

  return (
    <Link className={active ? 'sidebar-link active' : 'sidebar-link'} href={href as Route}>
      {children}
    </Link>
  );
}
