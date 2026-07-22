'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { BudgetCategory, BudgetMonth } from '@churchflow/shared';
import { BudgetCell } from './budget-cell';
import type { BudgetEntryBlurHandler, BudgetEntryNoteSaveHandler } from './budget-manager-types';
import { CurrencyTotals } from './budget-summary';
import {
  columnTotal,
  findEntry,
  formatAmount,
  formatTotalsInline,
  monthHasDataInRow,
  noteForField,
  spreadsheetColumns,
  type BudgetColumnLabels,
  type BudgetGroupLabels,
} from './budget-table-helpers';
import { DeleteBudgetMonthDialog } from './delete-budget-month-dialog';
import { DeleteBudgetRowDialog } from './delete-budget-row-dialog';

export function BudgetMonthTable({
  categories,
  columnLabels,
  groupLabels,
  month,
  monthNames,
  savingKeys,
  onDeleteMonth,
  onAddRow,
  onEntryBlur,
  onEntryNoteSave,
  onRemoveLastRow,
}: {
  categories: BudgetCategory[];
  columnLabels: BudgetColumnLabels;
  groupLabels: BudgetGroupLabels;
  month: BudgetMonth;
  monthNames: string[];
  savingKeys: Set<string>;
  onDeleteMonth: (monthId: string) => void;
  onAddRow: (monthId: string) => void;
  onEntryBlur: BudgetEntryBlurHandler;
  onEntryNoteSave: BudgetEntryNoteSaveHandler;
  onRemoveLastRow: (monthId: string) => void;
}) {
  const t = useTranslations('budget');
  const columns = spreadsheetColumns(categories, { columns: columnLabels, groups: groupLabels });
  const monthName = monthNames[month.month - 1] ?? String(month.month);
  const lastRowHasData = monthHasDataInRow(month, month.rowCount - 1);
  const rowMutationPending =
    savingKeys.has(`month:${month.id}:row:add`) || savingKeys.has(`month:${month.id}:row:remove`);

  return (
    <div className="grid gap-4">
      <BudgetMonthTableHeader
        lastRowHasData={lastRowHasData}
        month={month}
        monthName={monthName}
        rowMutationPending={rowMutationPending}
        onAddRow={onAddRow}
        onDeleteMonth={onDeleteMonth}
        onRemoveLastRow={onRemoveLastRow}
      />
      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-12 border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-2 text-center">
                  #
                </th>
                {columns.map((column) => (
                  <th
                    className="min-w-[112px] border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-2 text-center font-semibold"
                    key={column.id}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: month.rowCount }, (_, rowIndex) => (
                <tr key={rowIndex}>
                  <th className="sticky left-0 z-10 border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-1 text-center font-medium text-[var(--muted)]">
                    {rowIndex + 1}
                  </th>
                  {columns.map((column) => {
                    const entry = findEntry(month, column.category.id, rowIndex);
                    return (
                      <td className="border border-[var(--line)] p-0.5" key={column.id}>
                        <BudgetCell
                          note={noteForField(entry, column.noteField)}
                          value={entry[column.field]}
                          onAmountBlur={(value) =>
                            onEntryBlur(month.id, column.category.id, rowIndex, column.field, value)
                          }
                          onNoteSave={(note) =>
                            onEntryNoteSave(
                              month.id,
                              column.category.id,
                              rowIndex,
                              column.noteField,
                              note,
                            )
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th className="sticky left-0 z-10 border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-2 text-left">
                  {t('total')}
                </th>
                {columns.map((column) => (
                  <td
                    className="border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-2 text-right font-semibold tabular-nums"
                    key={column.id}
                  >
                    {formatAmount(columnTotal(month, column))}
                  </td>
                ))}
              </tr>
              <tr>
                <th
                  className="sticky left-0 z-10 border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-2 text-left"
                  colSpan={2}
                >
                  {t('monthSummary')}
                </th>
                <td
                  className="border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-2 font-semibold"
                  colSpan={columns.length - 1}
                >
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <span>
                      {t('income')}: {formatTotalsInline(month.totals.income)}
                    </span>
                    <span>
                      {t('expenses')}: {formatTotalsInline(month.totals.expense)}
                    </span>
                    <span>
                      {t('balance')}: {formatTotalsInline(month.totals.balance)}
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {savingKeys.size > 0 ? (
          <p className="m-0 border-t border-[var(--line)] px-3 py-2 text-xs text-[var(--muted)]">
            {t('savingChanges')}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function BudgetMonthTableHeader({
  lastRowHasData,
  month,
  monthName,
  rowMutationPending,
  onAddRow,
  onDeleteMonth,
  onRemoveLastRow,
}: {
  lastRowHasData: boolean;
  month: BudgetMonth;
  monthName: string;
  rowMutationPending: boolean;
  onAddRow: (monthId: string) => void;
  onDeleteMonth: (monthId: string) => void;
  onRemoveLastRow: (monthId: string) => void;
}) {
  const t = useTranslations('budget');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex md:flex-row flex-col justify-baseline items-start md:items-center gap-2">
        <h2 className="pr-3 md:self-end">{t('monthTable', { month: monthName })}</h2>
        <CurrencyTotals
          totals={month.totals.balance}
          className="mt-1 flex gap-3 text-sm font-semibold underline"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            aria-label={t('addRow')}
            className="h-8 w-8 px-0"
            disabled={rowMutationPending}
            type="button"
            variant="secondary"
            onClick={() => onAddRow(month.id)}
          >
            +
          </Button>
          {lastRowHasData ? (
            <DeleteBudgetRowDialog
              disabled={rowMutationPending || month.rowCount <= 1}
              monthName={monthName}
              rowNumber={month.rowCount}
              onConfirm={() => onRemoveLastRow(month.id)}
            />
          ) : (
            <Button
              aria-label={t('removeLastRow')}
              className="h-8 w-8 px-0"
              disabled={rowMutationPending || month.rowCount <= 1}
              type="button"
              variant="secondary"
              onClick={() => onRemoveLastRow(month.id)}
            >
              -
            </Button>
          )}
        </div>
        <DeleteBudgetMonthDialog monthName={monthName} onConfirm={() => onDeleteMonth(month.id)} />
      </div>
    </div>
  );
}
