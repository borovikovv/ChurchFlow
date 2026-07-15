import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/api/client';
import {
  createBudgetMonthSchema,
  listBudgetQuerySchema,
  updateBudgetEntryNoteSchema,
  type BudgetEntry,
  type BudgetEntryField,
  type BudgetMonth,
  type BudgetPayload,
  type CreateBudgetMonthInput,
  type UpdateBudgetEntryInput,
  type UpdateBudgetEntryNoteInput,
} from '@churchflow/shared';
import type { ActionResult } from './types';

function budgetPath(organizationId: string): string {
  return `/dashboard/${organizationId}/budget`;
}

export async function loadBudgetYearAction(
  organizationId: string,
  year: number,
): Promise<ActionResult<BudgetPayload>> {
  'use server';
  const parsed = listBudgetQuerySchema.safeParse({ year });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid budget year' };

  const result = await apiFetch<BudgetPayload>(
    `/organizations/${organizationId}/budget?${new URLSearchParams({
      year: String(parsed.data.year),
    })}`,
  );

  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error.message };
}

export async function createBudgetMonthAction(
  organizationId: string,
  input: CreateBudgetMonthInput,
): Promise<ActionResult<BudgetMonth>> {
  'use server';
  const parsed = createBudgetMonthSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid month' };

  const result = await apiFetch<BudgetMonth>(`/organizations/${organizationId}/budget/months`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed.data),
  });
  revalidatePath(budgetPath(organizationId));

  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error.message };
}

export async function deleteBudgetMonthAction(
  organizationId: string,
  monthId: string,
): Promise<ActionResult<{ deletedMonthId: string }>> {
  'use server';
  const result = await apiFetch<{ deletedMonthId: string }>(
    `/organizations/${organizationId}/budget/months/${monthId}`,
    { method: 'DELETE' },
  );
  revalidatePath(budgetPath(organizationId));

  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error.message };
}

export async function updateBudgetEntryAction(
  organizationId: string,
  monthId: string,
  categoryId: string,
  rowIndex: number,
  input: UpdateBudgetEntryInput,
): Promise<ActionResult<BudgetEntry>> {
  'use server';
  const result = await apiFetch<BudgetEntry>(
    `/organizations/${organizationId}/budget/months/${monthId}/rows/${rowIndex}/categories/${categoryId}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  revalidatePath(budgetPath(organizationId));

  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error.message };
}

export async function updateBudgetEntryNoteAction(
  organizationId: string,
  monthId: string,
  categoryId: string,
  rowIndex: number,
  field: BudgetEntryField,
  input: UpdateBudgetEntryNoteInput,
): Promise<ActionResult<BudgetEntry>> {
  'use server';
  const parsed = updateBudgetEntryNoteSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid note' };

  const result = await apiFetch<BudgetEntry>(
    `/organizations/${organizationId}/budget/months/${monthId}/rows/${rowIndex}/categories/${categoryId}/notes/${field}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data),
    },
  );
  revalidatePath(budgetPath(organizationId));

  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error.message };
}

export async function addBudgetMonthRowAction(
  organizationId: string,
  monthId: string,
): Promise<ActionResult<BudgetMonth>> {
  'use server';
  const result = await apiFetch<BudgetMonth>(
    `/organizations/${organizationId}/budget/months/${monthId}/rows`,
    { method: 'POST' },
  );
  revalidatePath(budgetPath(organizationId));

  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error.message };
}

export async function removeLastBudgetMonthRowAction(
  organizationId: string,
  monthId: string,
): Promise<ActionResult<BudgetMonth>> {
  'use server';
  const result = await apiFetch<BudgetMonth>(
    `/organizations/${organizationId}/budget/months/${monthId}/rows/last`,
    { method: 'DELETE' },
  );
  revalidatePath(budgetPath(organizationId));

  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error.message };
}
