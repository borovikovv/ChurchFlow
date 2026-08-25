'use client';

import { useTranslations } from 'next-intl';
import { FormSelect } from '@/components/forms/form-select';
import type { DateRangeValue } from '@/components/forms/date-range-input';
import { BUDGET_CURRENCIES, type BudgetCurrency, type BudgetMonth } from '@churchflow/shared';
import { AddMonthControls } from './add-month-controls';
import { BUDGET_CURRENCY_MESSAGE_KEY, yearOptions } from './budget-table-helpers';
import { ExportBudgetChartsDialog } from './export-budget-charts-dialog';

export function BudgetToolbar({
  baseCurrency,
  isPending,
  isExporting,
  isYearLoading,
  monthToAdd,
  monthNames,
  months,
  year,
  onAddMonth,
  onBaseCurrencyChange,
  onExportPng,
  onMonthToAddChange,
  onYearChange,
}: {
  baseCurrency: BudgetCurrency;
  isPending: boolean;
  isExporting: boolean;
  isYearLoading: boolean;
  monthToAdd: number | null;
  monthNames: string[];
  months: BudgetMonth[];
  year: number;
  onAddMonth: () => void;
  onBaseCurrencyChange: (currency: string) => void;
  onExportPng: (range: DateRangeValue) => void;
  onMonthToAddChange: (month: number | null) => void;
  onYearChange: (year: string) => void;
}) {
  const t = useTranslations('budget');

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <FormSelect
            label={t('year')}
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
        <div className="w-48">
          <FormSelect
            label={t('baseCurrency')}
            disabled={isPending}
            value={baseCurrency}
            onChange={(event) => onBaseCurrencyChange(event.currentTarget.value)}
          >
            {BUDGET_CURRENCIES.map((currency) => (
              <option value={currency} key={currency}>
                {t(BUDGET_CURRENCY_MESSAGE_KEY[currency])}
              </option>
            ))}
          </FormSelect>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <AddMonthControls
          disabled={isPending}
          monthToAdd={monthToAdd}
          monthNames={monthNames}
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
