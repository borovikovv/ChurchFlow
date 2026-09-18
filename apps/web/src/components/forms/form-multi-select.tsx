'use client';

import Select, { type MultiValue } from 'react-select';
import {
  createSelectStyles,
  type SelectOption,
  type SelectSize,
} from '@/components/forms/form-select';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { FormField } from './form-field';

export function FormMultiSelect({
  allowMobileKeyboard = false,
  className,
  error,
  label,
  noOptionsMessage,
  options,
  placeholder,
  size = 'default',
  value,
  onChange,
}: {
  allowMobileKeyboard?: boolean | undefined;
  className?: string | undefined;
  error?: string | undefined;
  label: string;
  noOptionsMessage: string;
  options: SelectOption[];
  placeholder: string;
  size?: SelectSize | undefined;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const selectedOptions = value.flatMap((selectedValue) => {
    const option = options.find((candidate) => candidate.value === selectedValue);
    return option ? [option] : [];
  });
  const maxMenuHeight = Math.min(240, Math.max(42, options.length * 40 + 8));
  const isMobile = useIsMobile();
  const isSearchable = allowMobileKeyboard || !isMobile;

  return (
    <FormField label={label} error={error} className={className}>
      {({ id, errorId, invalid }) => (
        <Select
          aria-describedby={errorId}
          aria-invalid={invalid}
          inputId={id}
          instanceId={id}
          isClearable
          isMulti
          isOptionDisabled={(option) => Boolean(option.isDisabled)}
          isSearchable={isSearchable}
          closeMenuOnSelect={false}
          maxMenuHeight={maxMenuHeight}
          menuPosition="fixed"
          menuShouldScrollIntoView={false}
          noOptionsMessage={() => noOptionsMessage}
          options={options}
          placeholder={placeholder}
          styles={createSelectStyles<true>(size, { wrapValues: true })}
          value={selectedOptions}
          onChange={(selected: MultiValue<SelectOption>) =>
            onChange(selected.map((option) => option.value))
          }
        />
      )}
    </FormField>
  );
}
