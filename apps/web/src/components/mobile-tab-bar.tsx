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

const NAV_CLASS_NAME =
  'fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+10px)] z-40 flex items-stretch rounded-[24px] border border-[rgba(255,255,255,0.55)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] px-1.5 py-2 shadow-[0_12px_32px_rgba(31,35,40,0.14),0_1px_2px_rgba(31,35,40,0.08),inset_0_1px_0_rgba(255,255,255,0.7),inset_0_-1px_0_rgba(255,255,255,0.25)] backdrop-blur-[28px] backdrop-saturate-[200%] backdrop-brightness-[1.08] md:hidden';

const TAB_CLASS_NAME =
  'flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-[18px] border-0 bg-transparent px-1 py-1 text-[11px] leading-tight font-semibold';

const TAB_ICON_CLASS_NAME = 'h-6 w-6';

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
      <nav aria-label={t('main')} className={NAV_CLASS_NAME}>
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
