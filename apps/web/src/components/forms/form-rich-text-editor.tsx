'use client';

import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { FormField } from './form-field';

export function FormRichTextEditor<
  T extends FieldValues,
  TContext,
  TTransformedValues extends FieldValues | undefined,
>({
  control,
  name,
  label,
  error,
  disabled = false,
}: {
  control: Control<T, TContext, TTransformedValues>;
  name: Path<T>;
  label: string;
  error?: string | undefined;
  disabled?: boolean;
}) {
  return (
    <FormField label={label} error={error}>
      {({ id, errorId, invalid }) => (
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <RichTextEditor
              describedBy={errorId}
              disabled={disabled}
              id={id}
              invalid={invalid}
              onBlur={field.onBlur}
              onChange={field.onChange}
              value={typeof field.value === 'string' ? field.value : ''}
            />
          )}
        />
      )}
    </FormField>
  );
}
