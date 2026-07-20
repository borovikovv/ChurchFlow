'use client';

import { toPng } from 'html-to-image';
import { useMemo, useRef, useState, useTransition } from 'react';
import { flushSync } from 'react-dom';
import type { BudgetEntryField, BudgetMonth } from '@churchflow/shared';
import type { DateRangeValue } from '@/components/forms/date-range-input';
import type { ActionResult } from '../types';
import { AddMonthControls } from './add-month-controls';
import { BudgetCharts } from './budget-charts';
import {
  budgetExportRangeLabel,
  budgetMonthsInRange,
  filterBudgetMonthsByRange,
} from './budget-export-range';
import type { BudgetManagerProps } from './budget-manager-types';
import { BudgetMonthTable } from './budget-month-table';
import { YearSummary } from './budget-summary';
import { BudgetToolbar } from './budget-toolbar';
import {
  buildGroupSummaries,
  emptyEntry,
  firstAvailableMonth,
  recalculateMonth,
  sumTotals,
  upsertEntry,
  type BudgetAmountField,
} from './budget-table-helpers';

export function BudgetManager({
  organizationId,
  payload,
  createMonth,
  deleteMonth,
  loadYear,
  addMonthRow,
  removeLastMonthRow,
  updateEntry,
  updateEntryNote,
}: BudgetManagerProps) {
  const exportChartRef = useRef<HTMLDivElement | null>(null);
  const [year, setYear] = useState(payload.year);
  const [categories, setCategories] = useState(payload.categories);
  const [months, setMonths] = useState(payload.months);
  const [monthToAdd, setMonthToAdd] = useState(firstAvailableMonth(payload.months));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportRange, setExportRange] = useState<DateRangeValue | null>(null);
  const [exporting, setExporting] = useState(false);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const yearTotals = useMemo(() => sumTotals(months.map((month) => month.totals)), [months]);
  const groupSummaries = useMemo(
    () => buildGroupSummaries(months, categories),
    [categories, months],
  );
  const exportMonths = useMemo(
    () => filterBudgetMonthsByRange(months, year, exportRange),
    [exportRange, months, year],
  );
  const exportGroupSummaries = useMemo(
    () => buildGroupSummaries(exportMonths, categories),
    [categories, exportMonths],
  );
  const exportDisplayMonths = useMemo(
    () => budgetMonthsInRange(year, exportRange),
    [exportRange, year],
  );
  const exportPeriodLabel = useMemo(
    () => (exportRange ? budgetExportRangeLabel(exportRange) : String(year)),
    [exportRange, year],
  );

  function runMutation<T>(
    key: string,
    mutation: () => Promise<ActionResult<T>>,
    onSuccess: (data: T) => void,
  ) {
    setSavingKeys((current) => new Set(current).add(key));
    setError(null);
    startTransition(async () => {
      const result = await mutation();
      setSavingKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess(result.data);
      setMessage('Saved');
    });
  }

  function handleYearChange(nextYear: string) {
    const parsedYear = Number(nextYear);
    if (!Number.isInteger(parsedYear) || parsedYear === year) return;

    setSavingKeys((current) => new Set(current).add('budget:year:load'));
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await loadYear(organizationId, parsedYear);
      setSavingKeys((current) => {
        const next = new Set(current);
        next.delete('budget:year:load');
        return next;
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setYear(result.data.year);
      setCategories(result.data.categories);
      setMonths(result.data.months);
      setMonthToAdd(firstAvailableMonth(result.data.months));
      window.history.pushState(null, '', `?year=${result.data.year}`);
    });
  }

  function handleAddMonth() {
    if (!monthToAdd) return;

    runMutation(
      'month:create',
      () => createMonth(organizationId, { year, month: monthToAdd }),
      (created) => {
        setMonths((current) => [...current, created].sort((a, b) => a.month - b.month));
        setMonthToAdd(firstAvailableMonth([...months, created]));
      },
    );
  }

  function handleDeleteMonth(monthId: string) {
    runMutation(
      `month:${monthId}:delete`,
      () => deleteMonth(organizationId, monthId),
      ({ deletedMonthId }) => {
        const nextMonths = months.filter((month) => month.id !== deletedMonthId);
        setMonths(nextMonths);
        setMonthToAdd(firstAvailableMonth(nextMonths));
      },
    );
  }

  function handleEntryBlur(
    monthId: string,
    categoryId: string,
    rowIndex: number,
    field: BudgetAmountField,
    rawValue: string,
  ) {
    const monthToUpdate = months.find((month) => month.id === monthId);
    if (!monthToUpdate) return;
    const parsedValue = Number(rawValue || 0);
    const currentEntry =
      monthToUpdate.entries.find(
        (entry) => entry.categoryId === categoryId && entry.rowIndex === rowIndex,
      ) ?? emptyEntry(categoryId, rowIndex);
    if (currentEntry[field] === parsedValue) return;

    runMutation(
      `entry:${monthToUpdate.id}:${rowIndex}:${categoryId}:${field}`,
      () =>
        updateEntry(organizationId, monthToUpdate.id, categoryId, rowIndex, {
          [field]: parsedValue,
        }),
      (updated) => {
        setMonths((current) =>
          current.map((month) => {
            if (month.id !== monthToUpdate.id) return month;
            const entries = upsertEntry(month.entries, updated);
            return recalculateMonth({ ...month, entries }, categories);
          }),
        );
      },
    );
  }

  function handleEntryNoteSave(
    monthId: string,
    categoryId: string,
    rowIndex: number,
    field: BudgetEntryField,
    note: string | null,
  ) {
    const monthToUpdate = months.find((month) => month.id === monthId);
    if (!monthToUpdate) return;

    runMutation(
      `entry-note:${monthId}:${rowIndex}:${categoryId}:${field}`,
      () =>
        updateEntryNote(organizationId, monthId, categoryId, rowIndex, field, {
          note,
        }),
      (updated) => {
        setMonths((current) =>
          current.map((month) => {
            if (month.id !== monthId) return month;
            const entries = upsertEntry(month.entries, updated);
            return recalculateMonth({ ...month, entries }, categories);
          }),
        );
      },
    );
  }

  function handleAddMonthRow(monthId: string) {
    runMutation(
      `month:${monthId}:row:add`,
      () => addMonthRow(organizationId, monthId),
      (updated) => updateMonthState(updated),
    );
  }

  function handleRemoveLastMonthRow(monthId: string) {
    runMutation(
      `month:${monthId}:row:remove`,
      () => removeLastMonthRow(organizationId, monthId),
      (updated) => updateMonthState(updated),
    );
  }

  function updateMonthState(updated: BudgetMonth) {
    setMonths((current) =>
      current
        .map((month) => (month.id === updated.id ? updated : month))
        .sort((a, b) => a.month - b.month),
    );
  }

  async function handleExportPng(range: DateRangeValue) {
    try {
      flushSync(() => {
        setExporting(true);
        setExportRange(range);
      });
      await waitForChartRender();

      const target = exportChartRef.current;
      if (!target) return;

      const dataUrl = await toPng(target, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `budget-${year}-${range.startDate ?? 'start'}-${range.endDate ?? 'end'}.png`;
      link.click();
    } finally {
      setExporting(false);
      setExportRange(null);
    }
  }

  return (
    <div className="stack">
      <BudgetToolbar
        isExporting={exporting}
        isPending={pending}
        isYearLoading={savingKeys.has('budget:year:load')}
        monthToAdd={monthToAdd}
        months={months}
        year={year}
        onAddMonth={handleAddMonth}
        onExportPng={handleExportPng}
        onMonthToAddChange={setMonthToAdd}
        onYearChange={handleYearChange}
      />

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}

      <YearSummary totals={yearTotals} />
      <BudgetCharts chartRef={null} months={months} groupSummaries={groupSummaries} year={year} />

      {exportRange ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[-10000px] top-0 w-[1200px]"
        >
          <BudgetCharts
            chartRef={exportChartRef}
            displayMonths={exportDisplayMonths ?? undefined}
            exportMode
            months={exportMonths}
            groupSummaries={exportGroupSummaries}
            periodLabel={exportPeriodLabel}
            year={year}
          />
        </div>
      ) : null}

      {months.length === 0 ? (
        <section className="table-empty-state grid gap-3 text-center">
          <strong>No budget months for {year} yet.</strong>
          <span>Create the first month to start tracking income and expenses.</span>
          <div className="mx-auto flex flex-wrap items-end justify-center gap-2">
            <AddMonthControls
              disabled={pending}
              monthToAdd={monthToAdd}
              months={months}
              onAdd={handleAddMonth}
              onMonthChange={setMonthToAdd}
            />
          </div>
        </section>
      ) : (
        <section className="stack">
          {months.map((month) => (
            <BudgetMonthTable
              categories={categories}
              key={month.id}
              month={month}
              savingKeys={savingKeys}
              onDeleteMonth={handleDeleteMonth}
              onAddRow={handleAddMonthRow}
              onEntryBlur={handleEntryBlur}
              onEntryNoteSave={handleEntryNoteSave}
              onRemoveLastRow={handleRemoveLastMonthRow}
            />
          ))}
          <div className="flex flex-wrap items-end gap-2 border-t border-[var(--line)] pt-3">
            <AddMonthControls
              disabled={pending}
              monthToAdd={monthToAdd}
              months={months}
              onAdd={handleAddMonth}
              onMonthChange={setMonthToAdd}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function waitForChartRender(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}
