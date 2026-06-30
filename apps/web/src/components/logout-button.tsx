'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function logout(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    try {
      await fetch('/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { accept: 'application/json' },
      });
    } finally {
      window.location.assign('/login');
    }
  }

  return (
    <form onSubmit={logout}>
      <Button className="sidebar-logout" disabled={pending} type="submit" variant="ghost">
        {pending ? 'Logging out…' : 'Log out'}
      </Button>
    </form>
  );
}
