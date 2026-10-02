'use client';

import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FormInput } from '@/components/forms/form-input';
import { SearchIcon } from '@/components/icons/action-icons';
import { queryHref } from '@/lib/query-href';

const SEARCH_INPUT_CLASS_NAME =
  'h-12 w-full rounded-full pl-11 md:h-8 md:rounded-[var(--radius)] md:pl-3';

export function QuerySearchInput({
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
      const nextSearch = value.trim();
      if (nextSearch === search) return;

      router.replace(queryHref(pathname, preserveParams, 'search', nextSearch) as Route);
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
