import Image from 'next/image';
import type { ButtonHTMLAttributes } from 'react';

// Every way into the app is offered as the same control, so no provider reads as the smaller
// option. Email carries the primary tone because it is the one that works for everybody.
export type AuthProviderTone = 'neutral' | 'primary';

export function AuthProviderButton({
  icon,
  label,
  tone = 'neutral',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: string;
  label: string;
  tone?: AuthProviderTone;
}) {
  return (
    <button
      className={
        tone === 'primary'
          ? 'auth-provider-button auth-provider-button-primary'
          : 'auth-provider-button'
      }
      {...props}
    >
      <span className="auth-provider-mark">
        <Image src={icon} alt="" width={20} height={20} aria-hidden="true" />
      </span>
      {label}
    </button>
  );
}
