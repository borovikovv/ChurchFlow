'use client';

import { useTranslations } from 'next-intl';
import type { FormEvent } from 'react';
import { LogoutIcon } from '@/components/icons/navigation-icons';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/hooks/use-logout';

export function LogoutButton() {
  const t = useTranslations('navigation');
  const { logout, pending } = useLogout();

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void logout();
  }

  return (
    <form onSubmit={submit}>
      <Button className="sidebar-logout" disabled={pending} type="submit" variant="ghost">
        <span className="sr-only">{pending ? t('signingOut') : t('signOut')}</span>
        <LogoutIcon className="h-5 w-5" />
      </Button>
    </form>
  );
}
