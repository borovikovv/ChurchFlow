'use client';

import { useTranslations } from 'next-intl';
import { FormSelect } from '@/components/forms/form-select';
import { Button } from '@/components/ui/button';
import type { BudgetMonth } from '@churchflow/shared';
import { availableMonths } from './budget-table-helpers';

export function AddMonthControls({
  disabled,
  monthToAdd,
  monthNames,
  months,
  onAdd,
  onMonthChange,
}: {
  disabled: boolean;
  monthToAdd: number | null;
  monthNames: string[];
  months: BudgetMonth[];
  onAdd: () => void;
  onMonthChange: (month: number | null) => void;
}) {
  const t = useTranslations('budget');
  const options = availableMonths(months);

  return (
    <>
      <div className="w-44">
        <FormSelect
          label={t('addMonth')}
          disabled={!monthToAdd}
          value={monthToAdd ?? ''}
          onChange={(event) => {
            const value = Number(event.currentTarget.value);
            onMonthChange(Number.isNaN(value) ? null : value);
          }}
        >
          {options.map((month) => (
            <option value={month} key={month}>
              {monthNames[month - 1]}
            </option>
          ))}
        </FormSelect>
      </div>
      <Button className="h-[42px]" disabled={!monthToAdd || disabled} type="button" onClick={onAdd}>
        {t('addMonth')}
      </Button>
    </>
  );
}
