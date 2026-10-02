import Link from 'next/link';
import type { Route } from 'next';
import type { VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { buttonClassName } from './button.styles';

export type ButtonVariant = NonNullable<VariantProps<typeof buttonClassName>['variant']>;

export type ButtonSize = NonNullable<VariantProps<typeof buttonClassName>['size']>;

export function Button({
  variant = 'primary',
  size,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClassName({ variant, size, className })} {...props} />;
}

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <Link className={buttonClassName({ variant, className })} href={href as Route}>
      {children}
    </Link>
  );
}
