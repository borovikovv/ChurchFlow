'use client';

import { FormSelect } from '@/components/forms/form-select';
import { Button } from '@/components/ui/button';
import type { BudgetMonth } from '@churchflow/shared';
import { MONTH_NAMES, availableMonths } from './budget-table-helpers';

export function AddMonthControls({
  disabled,
  monthToAdd,
  months,
  onAdd,
  onMonthChange,
}: {
  disabled: boolean;
  monthToAdd: number | null;
  months: BudgetMonth[];
  onAdd: () => void;
  onMonthChange: (month: number | null) => void;
}) {
  const options = availableMonths(months);

  return (
    <>
      <div className="w-44">
        <FormSelect
          label="Add month"
          disabled={!monthToAdd}
          value={monthToAdd ?? ''}
          onChange={(event) => {
            const value = Number(event.currentTarget.value);
            onMonthChange(Number.isNaN(value) ? null : value);
          }}
        >
          {options.map((month) => (
            <option value={month} key={month}>
              {MONTH_NAMES[month - 1]}
            </option>
          ))}
        </FormSelect>
      </div>
      <Button className="h-[42px]" disabled={!monthToAdd || disabled} type="button" onClick={onAdd}>
        Add month
      </Button>
    </>
  );
}
