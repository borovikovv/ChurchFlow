'use client';

import {
  Children,
  Fragment,
  isValidElement,
  useState,
  type ChangeEvent,
  type ChangeEventHandler,
  type FocusEvent,
  type FocusEventHandler,
  type ReactNode,
} from 'react';
import Select, { type SingleValue, type StylesConfig } from 'react-select';
import { FormField } from './form-field';

interface SelectOption {
  isDisabled?: boolean;
  label: string;
  value: string;
}

type FormSelectProps = {
  children: ReactNode;
  className?: string | undefined;
  defaultValue?: string | number | readonly string[] | undefined;
  disabled?: boolean | undefined;
  error?: string | undefined;
  label: string;
  labelClassName?: string | undefined;
  name?: string | undefined;
  onBlur?: FocusEventHandler<HTMLSelectElement> | undefined;
  onChange?: ChangeEventHandler<HTMLSelectElement> | undefined;
  required?: boolean | undefined;
  selectClassName?: string | undefined;
  value?: string | number | readonly string[] | undefined;
  clearable?: boolean | undefined;
};

type OptionElementProps = {
  children?: ReactNode;
  disabled?: boolean;
  value?: string | number | readonly string[];
};

const selectStyles: StylesConfig<SelectOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 42,
    borderColor: state.isFocused ? 'var(--accent)' : 'var(--line)',
    borderRadius: 'var(--radius)',
    backgroundColor: state.isDisabled ? 'var(--surface-subtle)' : 'var(--surface)',
    boxShadow: 'inset 0 1px 0 rgba(208, 215, 222, 0.2)',
    color: 'var(--foreground)',
    cursor: state.isDisabled ? 'not-allowed' : 'pointer',
    font: 'inherit',
    opacity: state.isDisabled ? 0.65 : 1,
    '&:hover': {
      borderColor: state.isFocused ? 'var(--accent)' : 'var(--line)',
    },
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? 'var(--accent-strong)' : 'var(--muted)',
    paddingInline: 10,
    '&:hover': {
      color: 'var(--accent-strong)',
    },
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
  input: (base) => ({
    ...base,
    color: 'var(--foreground)',
    margin: 0,
    padding: 0,
  }),
  menu: (base) => ({
    ...base,
    zIndex: 60,
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--surface)',
    boxShadow: '0 12px 28px rgba(31, 35, 40, 0.16)',
    overflow: 'hidden',
  }),
  menuList: (base) => ({
    ...base,
    paddingBlock: 4,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? '#ddf4ff'
      : state.isFocused
        ? 'var(--surface-subtle)'
        : 'var(--surface)',
    color: 'var(--foreground)',
    cursor: state.isDisabled ? 'not-allowed' : 'pointer',
    fontWeight: state.isSelected ? 600 : 400,
    opacity: state.isDisabled ? 0.6 : 1,
    paddingBlock: 8,
    paddingInline: 12,
    '&:active': {
      backgroundColor: state.isSelected ? '#ddf4ff' : 'var(--line-muted)',
    },
  }),
  placeholder: (base) => ({
    ...base,
    color: 'var(--muted)',
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--foreground)',
  }),
  valueContainer: (base) => ({
    ...base,
    paddingBlock: 0,
    paddingInline: 12,
  }),
};

export function FormSelect({
  label,
  error,
  children,
  className,
  defaultValue,
  disabled,
  clearable,
  labelClassName,
  name,
  onBlur,
  onChange,
  required,
  selectClassName,
  value,
}: FormSelectProps) {
  const options = extractOptions(children);
  const initialValue = stringValue(value ?? defaultValue ?? options[0]?.value ?? '');
  const [internalValue, setInternalValue] = useState(initialValue);
  const selectedValue = value === undefined ? internalValue : stringValue(value);
  const selectedOption = options.find((option) => option.value === selectedValue) ?? null;
  const maxMenuHeight = Math.min(240, Math.max(42, options.length * 40 + 8));

  return (
    <FormField label={label} error={error} className={className} labelClassName={labelClassName}>
      {({ id, errorId, invalid }) => (
        <>
          {name ? <input name={name} type="hidden" value={selectedValue} /> : null}
          <Select
            aria-describedby={errorId}
            aria-invalid={invalid}
            inputId={id}
            instanceId={id}
            isClearable={Boolean(clearable)}
            isDisabled={Boolean(disabled)}
            isOptionDisabled={(option) => Boolean(option.isDisabled)}
            maxMenuHeight={maxMenuHeight}
            menuPosition="fixed"
            menuShouldScrollIntoView={false}
            options={options}
            required={Boolean(required)}
            styles={selectStyles}
            value={selectedOption}
            {...(selectClassName ? { className: selectClassName } : {})}
            onBlur={() => {
              onBlur?.(createSelectEvent(name, selectedValue) as FocusEvent<HTMLSelectElement>);
            }}
            onChange={(nextOption: SingleValue<SelectOption>) => {
              const nextValue = nextOption?.value ?? '';
              if (value === undefined) {
                setInternalValue(nextValue);
              }
              onChange?.(createSelectEvent(name, nextValue) as ChangeEvent<HTMLSelectElement>);
            }}
          />
        </>
      )}
    </FormField>
  );
}

function extractOptions(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;

    if (child.type === Fragment) {
      const fragmentProps = child.props as { children?: ReactNode };
      options.push(...extractOptions(fragmentProps.children));
      return;
    }

    if (child.type !== 'option') return;

    const optionProps = child.props as OptionElementProps;
    const label = nodeToText(optionProps.children);
    options.push({
      isDisabled: Boolean(optionProps.disabled),
      label,
      value: stringValue(optionProps.value ?? label),
    });
  });

  return options;
}

function nodeToText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  return Children.toArray(node).map(nodeToText).join('');
}

function createSelectEvent(name: string | undefined, value: string) {
  const target = { name, type: 'select-one', value };

  return {
    currentTarget: target,
    target,
  };
}

function stringValue(value: unknown): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? '');
  }

  return String(value ?? '');
}
