import { apiFetch } from '@/api/client';
import { PageHeader } from '@/components/ui/page-header';
import type { BudgetPayload } from '@churchflow/shared';
import {
  addBudgetMonthRowAction,
  createBudgetMonthAction,
  deleteBudgetMonthAction,
  loadBudgetYearAction,
  removeLastBudgetMonthRowAction,
  updateBudgetEntryAction,
  updateBudgetEntryNoteAction,
} from './actions';
import { BudgetManager } from './_components/budget-manager';

export default async function BudgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { orgId } = await params;
  const { year: rawYear } = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = Number(rawYear ?? currentYear);
  const safeYear = Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : currentYear;
  const result = await apiFetch<BudgetPayload>(
    `/organizations/${orgId}/budget?${new URLSearchParams({ year: String(safeYear) })}`,
  );

  return (
    <div className="stack">
      <PageHeader
        title="Budget"
        description="Track monthly income, expenses, and yearly totals by fixed ministry groups."
      />
      {!result.ok ? (
        <p className="form-error">{result.error.message}</p>
      ) : (
        <BudgetManager
          organizationId={orgId}
          payload={result.data}
          createMonth={createBudgetMonthAction}
          deleteMonth={deleteBudgetMonthAction}
          loadYear={loadBudgetYearAction}
          addMonthRow={addBudgetMonthRowAction}
          removeLastMonthRow={removeLastBudgetMonthRowAction}
          updateEntry={updateBudgetEntryAction}
          updateEntryNote={updateBudgetEntryNoteAction}
        />
      )}
    </div>
  );
}
