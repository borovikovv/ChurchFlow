'use client';

import { useCallback, useState } from 'react';

export function useLogout(): { logout: () => Promise<void>; pending: boolean } {
  const [pending, setPending] = useState(false);

  const logout = useCallback(async (): Promise<void> => {
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
  }, []);

  return { logout, pending };
}
