import { apiFetch } from '@/api/client';
import { getCurrentUser } from '@/auth/session';
import { getMessages } from '@/i18n/messages';
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
import { BUDGET_START_YEAR, BUDGET_YEAR_LOOKAHEAD } from './constants';
import { BudgetManager } from './_components/budget-manager';

export default async function BudgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { orgId } = await params;
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? 'en');
  const { year: rawYear } = await searchParams;
  const currentYear = new Date().getFullYear();
  const maxBudgetYear = currentYear + BUDGET_YEAR_LOOKAHEAD;
  const defaultYear = Math.max(BUDGET_START_YEAR, Math.min(currentYear, maxBudgetYear));
  const year = Number(rawYear ?? currentYear);
  const safeYear =
    Number.isInteger(year) && year >= BUDGET_START_YEAR && year <= maxBudgetYear
      ? year
      : defaultYear;
  const result = await apiFetch<BudgetPayload>(
    `/organizations/${orgId}/budget?${new URLSearchParams({ year: String(safeYear) })}`,
  );

  return (
    <div className="stack">
      <PageHeader title={messages.budget.title} description={messages.budget.description} />
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
