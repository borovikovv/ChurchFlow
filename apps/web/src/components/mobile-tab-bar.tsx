'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { AppNavItem } from '@/components/app-navigation';
import { MoreIcon } from '@/components/icons/navigation-icons';
import { MoreNavigationSheet } from '@/components/more-navigation-sheet';
import { isNavPathActive } from '@/lib/nav-active';
import { navItemsInGroup } from '@/lib/nav-groups';

const TAB_CLASS_NAME =
  'flex flex-1 cursor-pointer flex-col items-center gap-0.5 border-0 bg-transparent px-1 py-1.5 text-[11px] leading-tight font-semibold';

const TAB_ICON_CLASS_NAME = 'h-5 w-5';

function tabClassName(active: boolean): string {
  return `${TAB_CLASS_NAME} ${active ? 'text-[var(--accent-mobile)]' : 'text-[var(--muted)]'}`;
}

export function MobileTabBar({ items }: { items: AppNavItem[] }) {
  const pathname = usePathname();
  const t = useTranslations('navigation');
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = navItemsInGroup(items, 'primary');
  const moreItems = navItemsInGroup(items, 'more');
  const moreIsActive = moreItems.some((item) => isNavPathActive(pathname, item.href, item.exact));

  if (primaryItems.length === 0) return null;

  return (
    <>
      <nav
        aria-label={t('main')}
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--line)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {primaryItems.map((item) => {
          const ItemIcon = item.icon;
          const active = isNavPathActive(pathname, item.href, item.exact);

          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={tabClassName(active)}
              href={item.href}
              key={item.href}
            >
              <ItemIcon className={TAB_ICON_CLASS_NAME} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        {moreItems.length > 0 ? (
          <button
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={tabClassName(moreOpen || moreIsActive)}
            type="button"
            onClick={() => setMoreOpen(true)}
          >
            <MoreIcon className={TAB_ICON_CLASS_NAME} />
            <span className="truncate">{t('more')}</span>
          </button>
        ) : null}
      </nav>

      <MoreNavigationSheet items={moreItems} open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
