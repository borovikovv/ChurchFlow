'use client';

import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import type { ChangeEvent } from 'react';
import { FormSelect } from './form-select';

export interface QueryFilterSelectOption {
  label: string;
  value: string;
}

export function QueryFilterSelect({
  label,
  name,
  options,
  value,
  preserveParams,
}: {
  label: string;
  name: string;
  options: QueryFilterSelectOption[];
  value: string;
  preserveParams?: Record<string, string | undefined>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const updateFilter = (event: ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams();
    Object.entries(preserveParams ?? {}).forEach(([paramName, paramValue]) => {
      if (paramValue) {
        params.set(paramName, paramValue);
      }
    });

    if (event.currentTarget.value) {
      params.set(name, event.currentTarget.value);
    }

    const query = params.toString();
    router.push((query ? `${pathname}?${query}` : pathname) as Route);
  };

  return (
    <FormSelect
      className="m-0 flex items-center gap-2"
      label={label}
      labelClassName="filter-label"
      name={name}
      selectClassName="min-w-40"
      value={value}
      onChange={updateFilter}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </FormSelect>
  );
}
