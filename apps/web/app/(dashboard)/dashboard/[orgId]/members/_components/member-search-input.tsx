'use client';

import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FormInput } from '@/components/forms/form-input';

export function MemberSearchInput({
  label,
  placeholder,
  search,
  preserveParams,
}: {
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
    <div className="w-full min-w-0">
      <FormInput
        className="h-8 w-full"
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
