'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { AppNavItem } from '@/components/app-navigation';
import { ChevronDownIcon } from '@/components/icons/action-icons';
import { LogoutIcon } from '@/components/icons/navigation-icons';
import { Avatar } from '@/components/ui/avatar';
import { useCloseOnOutsideClick } from '@/hooks/use-close-on-outside-click';
import { useLogout } from '@/hooks/use-logout';

const MENU_ROW_CLASS_NAME =
  'flex w-full min-w-0 cursor-pointer gap-3 border-0 border-b border-[var(--line-muted)] bg-transparent px-4 py-3 text-left text-[var(--foreground)] last:border-b-0 hover:bg-[var(--surface-subtle)]';

function menuRowClassName(hasDescription: boolean): string {
  return `${MENU_ROW_CLASS_NAME} ${hasDescription ? 'items-start' : 'items-center'}`;
}

function menuRowIconClassName(hasDescription: boolean): string {
  return `h-6 w-6 ${hasDescription ? 'mt-0.5' : ''}`;
}

export function UserMenu({
  avatarUrl,
  displayName,
  items,
}: {
  avatarUrl: string | null;
  displayName: string;
  items: AppNavItem[];
}) {
  const t = useTranslations('navigation');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const outsideClickRefs = useMemo(() => [containerRef], []);
  const { logout, pending } = useLogout();

  const close = useCallback(() => setOpen(false), []);

  useCloseOnOutsideClick({
    closeOnEscape: true,
    enabled: open,
    refs: outsideClickRefs,
    onOutsideClick: close,
  });

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-label={t('openAccountMenu')}
        className="flex cursor-pointer items-center gap-1 rounded-full border-0 bg-transparent p-0 text-[var(--muted)]"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <Avatar displayName={displayName} url={avatarUrl} fallback="initials" size="sm" />
        <ChevronDownIcon className="h-5 w-5" />
      </button>

      {open ? (
        <div
          aria-label={t('accountMenu')}
          className="absolute right-0 top-full z-50 mt-2 w-[min(264px,calc(100vw-24px))] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_18px_48px_rgba(31,35,40,0.22)]"
          role="group"
        >
          {items.map((item) => {
            const ItemIcon = item.icon;
            const hasDescription = Boolean(item.description);

            return (
              <Link
                className={menuRowClassName(hasDescription)}
                href={item.href}
                key={item.href}
                onClick={close}
              >
                <ItemIcon
                  className={`${menuRowIconClassName(hasDescription)} text-[var(--muted)]`}
                />
                <MenuRowText description={item.description} title={item.label} />
              </Link>
            );
          })}

          <button
            className={menuRowClassName(true)}
            disabled={pending}
            type="button"
            onClick={() => void logout()}
          >
            <LogoutIcon className={`${menuRowIconClassName(true)} text-[var(--danger)]`} />
            <MenuRowText
              description={t('signOutDescription')}
              title={pending ? t('signingOut') : t('signOut')}
            />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MenuRowText({ description, title }: { description?: string | undefined; title: string }) {
  return (
    <span className="grid min-w-0 gap-0.5">
      <strong className="truncate">{title}</strong>
      {description ? <small className="text-[var(--muted)]">{description}</small> : null}
    </span>
  );
}
