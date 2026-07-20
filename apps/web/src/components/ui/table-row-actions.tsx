'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';
import { useCloseOnOutsideClick } from '@/hooks/use-close-on-outside-click';

export const tableRowActionClassName =
  'flex min-h-[38px] w-full cursor-pointer items-center justify-start gap-2.5 rounded-md border-0 bg-transparent px-2.5 py-2 text-left font-medium text-[var(--foreground)] shadow-none hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-60';

const destructiveActionClassName = '!text-[var(--danger)]';

type TableRowActionsContextValue = {
  closeMenu: () => void;
};

const TableRowActionsContext = createContext<TableRowActionsContextValue | null>(null);

export function useTableRowActions() {
  const context = useContext(TableRowActionsContext);
  if (!context) {
    throw new Error('useTableRowActions must be used inside TableRowActions');
  }

  return context;
}

export function TableRowActions({
  children,
  className,
  ignoreOutsideClickRefs = [],
  label,
  outsideClickDisabled = false,
}: {
  children: ReactNode;
  className?: string | undefined;
  ignoreOutsideClickRefs?: Array<RefObject<Element | null>>;
  label: string;
  outsideClickDisabled?: boolean;
}) {
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
    refs: [menuRef as RefObject<Element | null>, ...ignoreOutsideClickRefs],
    onOutsideClick: closeMenu,
    enabled: menuOpen && !outsideClickDisabled,
  });

  return (
    <details
      className={
        className ??
        'group relative col-start-2 row-start-1 row-end-[span_4] self-start justify-self-end md:col-auto md:row-auto md:self-auto'
      }
      onToggle={(event) => {
        const open = event.currentTarget.open;
        setMenuOpen(open);
        setMenuPosition(open ? getMenuPosition() : null);
      }}
      ref={menuRef}
    >
      <summary
        aria-label={label}
        className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-[var(--radius)] border border-transparent text-[var(--foreground)] hover:border-[var(--line)] hover:bg-[var(--surface-subtle)] group-open:border-[var(--accent)] group-open:bg-[var(--surface-subtle)] group-open:ring-2 group-open:ring-[rgba(9,105,218,0.15)] [&::-webkit-details-marker]:hidden"
      >
        <svg aria-hidden="true" className="h-5 w-5 fill-current" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="10" cy="16" r="1.6" />
        </svg>
      </summary>
      <div
        className="fixed z-50 w-[220px] overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_12px_32px_rgba(31,35,40,0.16)]"
        ref={menuContentRef}
        style={{
          top: menuPosition?.top ?? 0,
          right: menuPosition?.right ?? 0,
          visibility: menuPosition ? 'visible' : 'hidden',
        }}
      >
        <TableRowActionsContext.Provider value={{ closeMenu }}>
          {children}
        </TableRowActionsContext.Provider>
      </div>
    </details>
  );
}

export function TableRowAction({
  children,
  className,
  destructive = false,
  onSelect,
  type = 'button',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  destructive?: boolean;
  onSelect?: () => void;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
}) {
  const context = useTableRowActions();

  return (
    <button
      className={[
        tableRowActionClassName,
        destructive ? destructiveActionClassName : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      type={type}
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (event.defaultPrevented || props.disabled) return;
        onSelect?.();
        if (onSelect) context.closeMenu();
      }}
    >
      {children}
    </button>
  );
}

export function tableRowActionClassNameFor({
  className,
  destructive = false,
}: {
  className?: string | undefined;
  destructive?: boolean;
} = {}) {
  return [tableRowActionClassName, destructive ? destructiveActionClassName : '', className ?? '']
    .filter(Boolean)
    .join(' ');
}
