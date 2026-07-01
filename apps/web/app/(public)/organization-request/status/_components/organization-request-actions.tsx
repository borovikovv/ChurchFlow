'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

export function OrganizationRequestActions({ dashboardHref }: { dashboardHref: string }) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        menuRef.current.open = false;
      }
    };

    document.addEventListener('click', closeOnOutsideClick);
    return () => document.removeEventListener('click', closeOnOutsideClick);
  }, []);

  return (
    <details className="group relative justify-self-end" ref={menuRef}>
      <summary
        className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-[var(--radius)] border border-transparent text-[var(--foreground)] hover:border-[var(--line)] hover:bg-[var(--surface-subtle)] group-open:border-[var(--accent)] group-open:bg-[var(--surface-subtle)] group-open:ring-2 group-open:ring-[rgba(9,105,218,0.15)] [&::-webkit-details-marker]:hidden"
        aria-label="Organization request actions"
      >
        <svg aria-hidden="true" className="h-5 w-5 fill-current" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="10" cy="16" r="1.6" />
        </svg>
      </summary>
      <div className="absolute top-[calc(100%+6px)] right-0 z-20 min-w-44 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_12px_32px_rgba(31,35,40,0.16)]">
        <Link
          className="flex min-h-9 items-center rounded-md px-3 py-2 font-medium whitespace-nowrap text-[var(--foreground)] hover:bg-[var(--surface-subtle)] hover:no-underline"
          href={dashboardHref}
        >
          Open dashboard
        </Link>
      </div>
    </details>
  );
}
