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
        <span className="sr-only">{pending ? 'Logging out…' : 'Log out'}</span>
        <svg
          aria-hidden="true"
          className="h-5 w-5 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
          viewBox="0 0 24 24"
        >
          <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4M9 12h9" />
        </svg>
      </Button>
    </form>
  );
}
