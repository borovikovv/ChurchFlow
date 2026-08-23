'use client';

import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FormInput } from '@/components/forms/form-input';
import { SearchIcon } from '@/components/icons/action-icons';

const SEARCH_INPUT_CLASS_NAME =
  'h-12 w-full rounded-full pl-11 md:h-8 md:rounded-[var(--radius)] md:pl-3';

export function MemberSearchInput({
  className,
  label,
  placeholder,
  search,
  preserveParams,
}: {
  className?: string | undefined;
  label: string;
  placeholder: string;
  search: string;
  preserveParams: Record<string, string | undefined>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [value, setValue] = useState(search);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams();
      Object.entries(preserveParams).forEach(([paramName, paramValue]) => {
        if (paramValue) {
          params.set(paramName, paramValue);
        }
      });

      const nextSearch = value.trim();
      if (nextSearch) {
        params.set('search', nextSearch);
      }

      if (nextSearch === search) return;

      const query = params.toString();
      router.replace((query ? `${pathname}?${query}` : pathname) as Route);
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [pathname, preserveParams, router, search, value]);

  return (
    <div className={['relative w-full min-w-0', className].filter(Boolean).join(' ')}>
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted)] md:hidden" />
      <FormInput
        className={SEARCH_INPUT_CLASS_NAME}
        fieldClassName="m-0 min-w-0"
        label={label}
        labelClassName="sr-only"
        name="search"
        placeholder={placeholder}
        type="search"
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
      />
    </div>
  );
}
