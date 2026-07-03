'use client';

import DatePicker from 'react-datepicker';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { FormField } from './form-field';
import { formatCalendarDate, parseCalendarDate } from './calendar-date';
import styles from './form-date-picker.module.css';

export function FormDatePicker<
  T extends FieldValues,
  TContext,
  TTransformedValues extends FieldValues | undefined,
>({
  control,
  name,
  label,
  error,
}: {
  control: Control<T, TContext, TTransformedValues>;
  name: Path<T>;
  label: string;
  error?: string | undefined;
}) {
  return (
    <FormField label={label} error={error}>
      {({ id, errorId, invalid }) => (
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <DatePicker
              id={id}
              aria-describedby={errorId}
              aria-invalid={invalid ? 'true' : 'false'}
              calendarClassName={styles['calendar'] ?? ''}
              className={styles['input'] ?? ''}
              dateFormat="MM/dd/yyyy"
              maxDate={new Date()}
              placeholderText="MM/DD/YYYY"
              portalId="datepicker-portal"
              selected={parseCalendarDate(field.value as string | null | undefined)}
              selectsMultiple={false}
              selectsRange={false}
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              isClearable
              onBlur={field.onBlur}
              onChange={(date: Date | null) => field.onChange(formatCalendarDate(date))}
            />
          )}
        />
      )}
    </FormField>
  );
}
