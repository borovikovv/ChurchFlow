'use client';

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';
import type { VariantProps } from 'class-variance-authority';
import { useCloseOnOutsideClick } from '@/hooks/use-close-on-outside-click';
import { actionMenuButtonClassName } from './action-menu-button.styles';

export interface ActionMenuButtonItem {
  icon?: ReactNode;
  label: string;
  onSelect: () => void;
}

export function ActionMenuButton({
  icon,
  items,
  label,
  size,
}: {
  icon?: ReactNode;
  items: ActionMenuButtonItem[];
  label: string;
} & VariantProps<typeof actionMenuButtonClassName>) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const menuContentRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  const closeMenu = useCallback(() => {
    if (menuRef.current) menuRef.current.open = false;
    setMenuOpen(false);
    setMenuPosition(null);
  }, []);

  const getMenuPosition = useCallback(() => {
    const trigger = menuRef.current?.querySelector('summary');
    if (!trigger) return null;

    const triggerRect = trigger.getBoundingClientRect();
    const menuHeight = menuContentRef.current?.offsetHeight ?? 0;
    const preferredTop = triggerRect.bottom + 6;
    const maxTop = window.innerHeight - menuHeight - 8;

    return {
      top: Math.max(8, Math.min(preferredTop, maxTop)),
      right: Math.max(8, window.innerWidth - triggerRect.right),
    };
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) return;

    const updateMenuPosition = () => {
      const nextPosition = getMenuPosition();
      if (nextPosition) setMenuPosition(nextPosition);
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [getMenuPosition, menuOpen]);

  useCloseOnOutsideClick({
    closeOnEscape: true,
    refs: [menuRef as RefObject<Element | null>],
    onOutsideClick: closeMenu,
    enabled: menuOpen,
  });

  return (
    <details
      className="relative"
      onToggle={(event) => {
        const open = event.currentTarget.open;
        setMenuOpen(open);
        setMenuPosition(open ? getMenuPosition() : null);
      }}
      ref={menuRef}
    >
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className={actionMenuButtonClassName({ size })}>
          {icon}
          {label}
          <ChevronIcon />
        </span>
      </summary>
      <div
        className="fixed z-50 grid w-[240px] gap-1 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_12px_32px_rgba(31,35,40,0.16)]"
        ref={menuContentRef}
        style={{
          top: menuPosition?.top ?? 0,
          right: menuPosition?.right ?? 0,
          visibility: menuPosition ? 'visible' : 'hidden',
        }}
      >
        {items.map((item) => (
          <ActionMenuItem
            key={item.label}
            onClick={() => {
              item.onSelect();
              closeMenu();
            }}
          >
            {item.icon ? (
              <span className="grid h-5 w-5 place-items-center">{item.icon}</span>
            ) : null}
            <span>{item.label}</span>
          </ActionMenuItem>
        ))}
      </div>
    </details>
  );
}

function ActionMenuItem({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className="flex min-h-[40px] w-full cursor-pointer items-center justify-start gap-3 rounded-md border-0 bg-transparent px-3 py-2 text-left font-medium text-[var(--foreground)] shadow-none hover:bg-[var(--surface-subtle)]"
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
