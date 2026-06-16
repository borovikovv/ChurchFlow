'use client';

import { useEffect, useRef } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ToastContainer, toast } from 'react-toastify';

export function ToastProvider() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastError = useRef<string | null>(null);
  const error = searchParams.get('error');

  useEffect(() => {
    if (!error || error === lastError.current) {
      return;
    }

    lastError.current = error;
    toast.error(error);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('error');
    const nextUrl = nextParams.size > 0 ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextUrl as Route, { scroll: false });
  }, [error, pathname, router, searchParams]);

  return (
    <ToastContainer
      position="top-right"
      autoClose={5000}
      closeOnClick
      pauseOnFocusLoss
      pauseOnHover
      theme="light"
    />
  );
}
