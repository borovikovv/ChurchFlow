'use client';

import { FormSelect } from '@/components/forms/form-select';
import { Button } from '@/components/ui/button';
import type { BudgetMonth } from '@churchflow/shared';
import { AddMonthControls } from './add-month-controls';
import { yearOptions } from './budget-table-helpers';

export function BudgetToolbar({
  isPending,
  isYearLoading,
  monthToAdd,
  months,
  year,
  onAddMonth,
  onExportPng,
  onMonthToAddChange,
  onYearChange,
}: {
  isPending: boolean;
  isYearLoading: boolean;
  monthToAdd: number | null;
  months: BudgetMonth[];
  year: number;
  onAddMonth: () => void;
  onExportPng: () => void;
  onMonthToAddChange: (month: number | null) => void;
  onYearChange: (year: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="w-40">
        <FormSelect
          label="Year"
          disabled={isYearLoading}
          value={year}
          onChange={(event) => onYearChange(event.currentTarget.value)}
        >
          {yearOptions(year).map((yearOption) => (
            <option value={yearOption} key={yearOption}>
              {yearOption}
            </option>
          ))}
        </FormSelect>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <AddMonthControls
          disabled={isPending}
          monthToAdd={monthToAdd}
          months={months}
          onAdd={onAddMonth}
          onMonthChange={onMonthToAddChange}
        />
        <Button className="h-[42px]" variant="secondary" type="button" onClick={onExportPng}>
          Export PNG
        </Button>
      </div>
    </div>
  );
}
