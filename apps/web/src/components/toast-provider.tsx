'use client';

import { useEffect, useRef } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ToastContainer, toast } from 'react-toastify';
import { useTopLayer } from '@/hooks/use-top-layer';

export function ToastProvider() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const layerRef = useRef<HTMLDivElement>(null);
  const error = searchParams.get('error');

  useTopLayer(layerRef);

  useEffect(() => {
    if (!error) return;

    toast.error(error, { toastId: `url-error:${error}` });

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('error');
    const nextUrl = nextParams.size > 0 ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextUrl as Route, { scroll: false });
  }, [error, pathname, router, searchParams]);

  return (
    <div
      ref={layerRef}
      popover="manual"
      className="pointer-events-none fixed inset-0 m-0 h-auto w-auto max-h-none max-w-none overflow-visible border-0 bg-transparent p-0 [&>*]:pointer-events-auto"
    >
      <ToastContainer
        position="top-right"
        autoClose={5000}
        closeOnClick
        pauseOnFocusLoss
        pauseOnHover
        theme="light"
      />
    </div>
  );
}
