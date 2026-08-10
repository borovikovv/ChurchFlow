'use client';

import DatePicker from 'react-datepicker';
import { FormField } from './form-field';
import { formatCalendarDate, parseCalendarDate } from './calendar-date';
import styles from './form-date-picker.module.css';

export type DateRangeValue = {
  endDate: string | null;
  startDate: string | null;
};

export function DateRangeInput({
  disabled = false,
  error,
  label,
  maxDate,
  minDate,
  onChange,
  value,
}: {
  disabled?: boolean;
  error?: string | undefined;
  label: string;
  maxDate?: Date | null;
  minDate?: Date | null;
  onChange: (value: DateRangeValue) => void;
  value: DateRangeValue;
}) {
  const startDate = parseCalendarDate(value.startDate);
  const endDate = parseCalendarDate(value.endDate);

  return (
    <FormField label={label} error={error}>
      {({ id, errorId, invalid }) => (
        <DatePicker
          id={id}
          aria-describedby={errorId}
          aria-invalid={invalid ? 'true' : 'false'}
          calendarClassName={styles['calendar'] ?? ''}
          calendarStartDay={1}
          className={styles['input'] ?? ''}
          dateFormat="MM/dd/yyyy"
          disabled={disabled}
          endDate={endDate}
          placeholderText="MM/DD/YYYY - MM/DD/YYYY"
          popperPlacement="bottom-start"
          popperClassName={styles['popper'] ?? ''}
          popperProps={{ strategy: 'fixed' }}
          selected={startDate}
          selectsRange
          showMonthDropdown
          showYearDropdown
          startDate={startDate}
          dropdownMode="select"
          isClearable
          {...(maxDate ? { maxDate } : {})}
          {...(minDate ? { minDate } : {})}
          onChange={(dates) => {
            if (!dates) {
              onChange({ startDate: null, endDate: null });
              return;
            }

            const [nextStartDate, nextEndDate] = dates as [Date | null, Date | null];
            onChange({
              startDate: formatCalendarDate(nextStartDate),
              endDate: formatCalendarDate(nextEndDate),
            });
          }}
        />
      )}
    </FormField>
  );
}
