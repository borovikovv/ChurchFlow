'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormInput } from './form-input';
import { FormSelect, type SelectOption } from './form-select';
import { FormTextarea } from './form-textarea';

export type RepeaterRow = Record<string, string>;

interface RepeaterFieldBase {
  defaultValue?: string | undefined;
  key: string;
  label: string;
  // The posted field name. Every row posts one value per field, so a row is read back on the
  // server by taking the same index out of each name's parallel value list.
  name: string;
  required?: boolean | undefined;
}

export interface RepeaterTextField extends RepeaterFieldBase {
  kind: 'text';
  maxLength?: number | undefined;
  placeholder?: string | undefined;
  type?: 'text' | 'time' | undefined;
}

export interface RepeaterTextAreaField extends RepeaterFieldBase {
  kind: 'textarea';
  maxLength?: number | undefined;
  placeholder?: string | undefined;
  rows?: number | undefined;
}

export interface RepeaterNumberField extends RepeaterFieldBase {
  kind: 'number';
  max: number;
  min: number;
}

export interface RepeaterSelectField extends RepeaterFieldBase {
  kind: 'select';
  options: readonly SelectOption[];
}

/**
 * A value a row carries without editing it. It has to travel with its own row, because the server
 * reads a row back by index out of the parallel lists the fields post.
 */
export interface RepeaterHiddenField {
  defaultValue?: string | undefined;
  key: string;
  kind: 'hidden';
  name: string;
}

export type RepeaterField =
  | RepeaterTextField
  | RepeaterTextAreaField
  | RepeaterNumberField
  | RepeaterSelectField
  | RepeaterHiddenField;

interface RepeaterEntry {
  id: string;
  values: RepeaterRow;
}

export function FormRepeater({
  addLabel,
  fields,
  hint,
  label,
  maxRows,
  rows,
}: {
  addLabel: string;
  fields: readonly RepeaterField[];
  hint?: string | undefined;
  label: string;
  maxRows: number;
  rows: readonly RepeaterRow[];
}) {
  const t = useTranslations('common');
  const nextIndexRef = useRef(rows.length);
  const [entries, setEntries] = useState<RepeaterEntry[]>(() =>
    rows.map((values, index) => ({ id: `row-${index}`, values })),
  );

  const addRow = () => {
    const id = `row-${nextIndexRef.current}`;
    nextIndexRef.current += 1;
    setEntries((current) => [...current, { id, values: emptyRow(fields) }]);
  };

  const removeRow = (id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  };

  const moveRow = (index: number, offset: number) => {
    setEntries((current) => {
      const moved = current[index];
      const target = index + offset;
      if (!moved || target < 0 || target >= current.length) return current;

      const next = current.filter((_, position) => position !== index);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const setValue = (id: string, key: string, value: string) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, values: { ...entry.values, [key]: value } } : entry,
      ),
    );
  };

  return (
    <fieldset className="m-0 grid gap-2 border-0 p-0">
      <legend className="mb-1 p-0 font-semibold">{label}</legend>
      {hint ? <p className="m-0 text-xs text-[var(--muted)]">{hint}</p> : null}
      {entries.length === 0 ? (
        <p className="m-0 text-sm text-[var(--muted)]">{t('repeater.empty')}</p>
      ) : (
        <ol className="m-0 grid list-none gap-2 p-0">
          {entries.map((entry, index) => (
            <li
              className="grid gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] p-3"
              key={entry.id}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {fields.map((field) => (
                  <RepeaterFieldInput
                    field={field}
                    key={field.key}
                    value={entry.values[field.key] ?? ''}
                    onChange={(value) => setValue(entry.id, field.key, value)}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-1">
                <Button
                  aria-label={t('repeater.moveUp', { position: index + 1 })}
                  className="h-8 w-8 px-0"
                  disabled={index === 0}
                  type="button"
                  variant="secondary"
                  onClick={() => moveRow(index, -1)}
                >
                  <span aria-hidden="true">↑</span>
                </Button>
                <Button
                  aria-label={t('repeater.moveDown', { position: index + 1 })}
                  className="h-8 w-8 px-0"
                  disabled={index === entries.length - 1}
                  type="button"
                  variant="secondary"
                  onClick={() => moveRow(index, 1)}
                >
                  <span aria-hidden="true">↓</span>
                </Button>
                <Button
                  aria-label={t('repeater.remove', { position: index + 1 })}
                  className="h-8 w-8 px-0"
                  type="button"
                  variant="danger"
                  onClick={() => removeRow(entry.id)}
                >
                  <span aria-hidden="true">×</span>
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div>
        <Button
          disabled={entries.length >= maxRows}
          type="button"
          variant="secondary"
          onClick={addRow}
        >
          {addLabel}
        </Button>
      </div>
    </fieldset>
  );
}

function RepeaterFieldInput({
  field,
  value,
  onChange,
}: {
  field: RepeaterField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.kind === 'hidden') {
    return <input name={field.name} readOnly type="hidden" value={value} />;
  }

  if (field.kind === 'select') {
    return (
      <FormSelect
        label={field.label}
        name={field.name}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FormSelect>
    );
  }

  if (field.kind === 'textarea') {
    return (
      <FormTextarea
        label={field.label}
        maxLength={field.maxLength}
        name={field.name}
        placeholder={field.placeholder}
        required={Boolean(field.required)}
        rows={field.rows ?? 2}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  }

  if (field.kind === 'number') {
    return (
      <FormInput
        label={field.label}
        max={field.max}
        min={field.min}
        name={field.name}
        required={Boolean(field.required)}
        type="number"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  }

  return (
    <FormInput
      label={field.label}
      maxLength={field.maxLength}
      name={field.name}
      placeholder={field.placeholder}
      required={Boolean(field.required)}
      type={field.type ?? 'text'}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}

function emptyRow(fields: readonly RepeaterField[]): RepeaterRow {
  return Object.fromEntries(fields.map((field) => [field.key, initialValue(field)]));
}

function initialValue(field: RepeaterField): string {
  if (field.defaultValue !== undefined) return field.defaultValue;

  return field.kind === 'select' ? (field.options[0]?.value ?? '') : '';
}
