import type { VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { badgeClassName } from './badge.styles';

export type BadgeIntent = NonNullable<VariantProps<typeof badgeClassName>['intent']>;

export function Badge({
  children,
  className,
  icon,
  intent,
  size,
}: {
  children: ReactNode;
  className?: string | undefined;
  icon?: ReactNode;
} & VariantProps<typeof badgeClassName>) {
  return (
    <span className={badgeClassName({ intent, size, className })}>
      {icon}
      {children}
    </span>
  );
}
