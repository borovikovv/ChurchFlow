'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { AppNavItem } from '@/components/app-navigation';
import { ChevronRightIcon } from '@/components/icons/action-icons';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { BOTTOM_SHEET_ROW_CLASS_NAME } from '@/components/ui/bottom-sheet.styles';

export function MoreNavigationSheet({
  items,
  open,
  onClose,
}: {
  items: AppNavItem[];
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('navigation');

  return (
    <BottomSheet open={open} title={t('more')} onClose={onClose}>
      <nav aria-label={t('more')}>
        {items.map((item) => {
          const ItemIcon = item.icon;

          return (
            <Link
              className={BOTTOM_SHEET_ROW_CLASS_NAME}
              href={item.href}
              key={item.href}
              onClick={onClose}
            >
              <ItemIcon className="h-6 w-6 text-[var(--accent-mobile)]" />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <strong className="truncate">{item.label}</strong>
                {item.description ? (
                  <small className="text-[var(--muted)]">{item.description}</small>
                ) : null}
              </span>
              <ChevronRightIcon className="h-5 w-5 text-[var(--muted)]" />
            </Link>
          );
        })}
      </nav>
    </BottomSheet>
  );
}
