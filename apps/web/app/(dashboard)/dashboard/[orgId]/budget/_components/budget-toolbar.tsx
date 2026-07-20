'use client';

import { FormSelect } from '@/components/forms/form-select';
import type { DateRangeValue } from '@/components/forms/date-range-input';
import type { BudgetMonth } from '@churchflow/shared';
import { AddMonthControls } from './add-month-controls';
import { yearOptions } from './budget-table-helpers';
import { ExportBudgetChartsDialog } from './export-budget-charts-dialog';

export function BudgetToolbar({
  isPending,
  isExporting,
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
  isExporting: boolean;
  isYearLoading: boolean;
  monthToAdd: number | null;
  months: BudgetMonth[];
  year: number;
  onAddMonth: () => void;
  onExportPng: (range: DateRangeValue) => void;
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
        <ExportBudgetChartsDialog
          disabled={isPending}
          isExporting={isExporting}
          year={year}
          onExport={onExportPng}
        />
      </div>
    </div>
  );
}
