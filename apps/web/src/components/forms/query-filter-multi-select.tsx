'use client';

import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import Select, { type MultiValue } from 'react-select';
import {
  createSelectStyles,
  type SelectOption,
  type SelectSize,
} from '@/components/forms/form-select';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { FormField } from './form-field';

export function QueryFilterMultiSelect({
  allowMobileKeyboard = false,
  label,
  labelClassName = 'filter-label',
  name,
  options,
  placeholder,
  preserveParams,
  selectClassName,
  size = 'medium',
  value,
}: {
  allowMobileKeyboard?: boolean | undefined;
  label: string;
  labelClassName?: string;
  name: string;
  options: SelectOption[];
  placeholder: string;
  preserveParams?: Record<string, string | undefined>;
  selectClassName?: string | undefined;
  size?: SelectSize | undefined;
  value: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const selectedOptions = options.filter((option) => value.includes(option.value));
  const maxMenuHeight = Math.min(280, Math.max(42, options.length * 40 + 8));
  const isMobile = useIsMobile();
  const isSearchable = allowMobileKeyboard || !isMobile;

  const updateFilter = (selected: MultiValue<SelectOption>) => {
    const params = new URLSearchParams();
    Object.entries(preserveParams ?? {}).forEach(([paramName, paramValue]) => {
      if (paramValue) {
        params.set(paramName, paramValue);
      }
    });

    const nextValue = selected.map((option) => option.value).join(',');
    if (nextValue) {
      params.set(name, nextValue);
    }

    const query = params.toString();
    router.push((query ? `${pathname}?${query}` : pathname) as Route);
  };

  return (
    <FormField label={label} className="m-0" labelClassName={labelClassName}>
      {({ id }) => (
        <Select
          inputId={id}
          instanceId={id}
          isClearable
          isMulti
          isSearchable={isSearchable}
          closeMenuOnSelect={false}
          maxMenuHeight={maxMenuHeight}
          menuPosition="fixed"
          menuShouldScrollIntoView={false}
          options={options}
          placeholder={placeholder}
          styles={createSelectStyles<true>(size)}
          value={selectedOptions}
          {...(selectClassName ? { className: selectClassName } : {})}
          onChange={updateFilter}
        />
      )}
    </FormField>
  );
}
