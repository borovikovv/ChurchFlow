import type { ReactNode } from 'react';

const ICON_BASE_CLASS_NAME =
  'shrink-0 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]';

const ICON_DEFAULT_CLASS_NAME = 'h-6 w-6';

export interface IconProps {
  className?: string | undefined;
}

export function Icon({
  children,
  className = ICON_DEFAULT_CLASS_NAME,
}: IconProps & { children: ReactNode }) {
  return (
    <svg aria-hidden="true" className={`${ICON_BASE_CLASS_NAME} ${className}`} viewBox="0 0 24 24">
      {children}
    </svg>
  );
}
