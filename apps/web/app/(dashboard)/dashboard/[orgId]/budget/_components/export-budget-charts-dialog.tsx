'use client';

import { useId, useRef, useState } from 'react';
import { DateRangeInput, type DateRangeValue } from '@/components/forms/date-range-input';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { defaultBudgetExportRange } from './budget-export-range';

export function ExportBudgetChartsDialog({
  disabled = false,
  isExporting = false,
  onExport,
  year,
}: {
  disabled?: boolean;
  isExporting?: boolean;
  onExport: (range: DateRangeValue) => void;
  year: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = useId();
  const [range, setRange] = useState<DateRangeValue>(() => defaultBudgetExportRange(year));
  const rangeComplete = Boolean(range.startDate && range.endDate);

  function resetRange() {
    setRange(defaultBudgetExportRange(year));
  }

  return (
    <FormDialog
      dialogRef={dialogRef}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            Cancel
          </Button>
          <Button disabled={!rangeComplete || isExporting} form={formId} type="submit">
            {isExporting ? 'Exporting...' : 'Export PNG'}
          </Button>
        </div>
      }
      title="Export budget charts"
      triggerClassName="h-[42px]"
      triggerDisabled={disabled || isExporting}
      triggerLabel="Export PNG"
      onOpen={resetRange}
    >
      <form
        className="grid gap-4"
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          if (!rangeComplete) return;
          dialogRef.current?.close();
          onExport(range);
        }}
      >
        <p className="m-0 text-sm text-[var(--muted)]">
          Choose the period that should appear in the exported budget charts. The page charts stay
          unchanged; only the PNG uses this range.
        </p>
        <DateRangeInput label="Date range" value={range} onChange={setRange} />
      </form>
    </FormDialog>
  );
}
