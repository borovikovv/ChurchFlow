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
  allowMobileKeyboard = false,
  label,
  labelClassName = 'filter-label',
  name,
  options,
  size,
  value,
  preserveParams,
}: {
  allowMobileKeyboard?: boolean | undefined;
  label: string;
  labelClassName?: string;
  name: string;
  options: QueryFilterSelectOption[];
  size?: 'default' | 'medium';
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
      labelClassName={labelClassName}
      name={name}
      allowMobileKeyboard={allowMobileKeyboard}
      selectClassName="md:w-60 w-full max-w-full"
      size={size}
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
