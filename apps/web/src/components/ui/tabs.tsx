'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { tabClassName } from './tabs.styles';

export interface TabItem {
  label: string;
  href: string;
  active?: boolean;
  count?: number;
  icon?: ReactNode;
}

export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  const pathname = usePathname();

  return (
    <nav className="ui-tabs" aria-label={label}>
      {items.map((item) => {
        const active =
          item.active ?? pathname === new URL(item.href, 'https://churchflow.local').pathname;
        return (
          <Link
            className={tabClassName({
              withIcon: Boolean(item.icon),
              className: active ? 'active' : undefined,
            })}
            href={item.href as Route}
            key={item.href}
            aria-current={active ? 'page' : undefined}
          >
            {item.icon}
            {item.label}
            {item.count === undefined ? null : <span className="ui-tab-count">{item.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
