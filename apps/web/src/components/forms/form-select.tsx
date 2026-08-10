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

export interface SelectOption {
  isDisabled?: boolean;
  label: string;
  value: string;
}

export type SelectSize = 'default' | 'medium';

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
  size?: SelectSize | undefined;
  value?: string | number | readonly string[] | undefined;
  clearable?: boolean | undefined;
};

type OptionElementProps = {
  children?: ReactNode;
  disabled?: boolean;
  value?: string | number | readonly string[];
};

export function createSelectStyles<IsMulti extends boolean = false>(
  size: SelectSize,
): StylesConfig<SelectOption, IsMulti> {
  const medium = size === 'medium';
  const controlHeight = medium ? 32 : 42;

  return {
    control: (base, state) => ({
      ...base,
      alignItems: 'center',
      minHeight: controlHeight,
      height: controlHeight,
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
      alignItems: 'center',
      color: state.isFocused ? 'var(--accent-strong)' : 'var(--muted)',
      display: 'flex',
      height: '100%',
      minHeight: 0,
      paddingBottom: 0,
      paddingLeft: medium ? 6 : 10,
      paddingRight: medium ? 6 : 10,
      paddingTop: 0,
      '&:hover': {
        color: 'var(--accent-strong)',
      },
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    indicatorsContainer: (base) => ({
      ...base,
      alignItems: 'center',
      height: '100%',
    }),
    input: (base) => ({
      ...base,
      color: 'var(--foreground)',
      alignSelf: 'center',
      lineHeight: medium ? '20px' : base.lineHeight,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      marginTop: 0,
      padding: 0,
      maxHeight: medium ? 20 : base.maxHeight,
      input: {
        minHeight: 0,
        border: 0,
        padding: 0,
        background: 'transparent',
        boxShadow: 'none',
        lineHeight: medium ? '20px' : 'inherit',
      },
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
      paddingBlock: medium ? 5 : 8,
      paddingInline: medium ? 8 : 12,
      '&:active': {
        backgroundColor: state.isSelected ? '#ddf4ff' : 'var(--line-muted)',
      },
    }),
    placeholder: (base) => ({
      ...base,
      alignSelf: 'center',
      color: 'var(--muted)',
      height: 'auto',
      lineHeight: medium ? 'normal' : base.lineHeight,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      marginTop: 0,
      maxHeight: medium ? controlHeight : base.maxHeight,
    }),
    singleValue: (base) => ({
      ...base,
      alignSelf: 'center',
      color: 'var(--foreground)',
      height: 'auto',
      lineHeight: medium ? 'normal' : base.lineHeight,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      marginTop: 0,
      maxHeight: medium ? controlHeight : base.maxHeight,
    }),
    multiValue: (base) => ({
      ...base,
      alignItems: 'center',
      borderRadius: 999,
      backgroundColor: '#fd8c73',
      color: '#5f1f12',
      minHeight: medium ? 22 : 26,
      margin: 2,
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: '#5f1f12',
      fontSize: medium ? 12 : 13,
      fontWeight: 600,
      padding: 0,
      paddingLeft: 8,
    }),
    multiValueRemove: (base) => ({
      ...base,
      borderRadius: 999,
      color: '#5f1f12',
      paddingLeft: 4,
      paddingRight: 6,
      ':hover': {
        backgroundColor: 'rgba(31, 35, 40, 0.12)',
        color: '#5f1f12',
      },
    }),
    valueContainer: (base) => ({
      ...base,
      alignItems: 'center',
      display: medium ? 'flex' : 'grid',
      flexWrap: 'nowrap',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      paddingBottom: 0,
      paddingLeft: medium ? 8 : 12,
      paddingRight: medium ? 8 : 12,
      paddingTop: 0,
    }),
  };
}

const selectStyles = createSelectStyles('default');

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
  size = 'default',
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
            styles={size === 'medium' ? createSelectStyles('medium') : selectStyles}
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
