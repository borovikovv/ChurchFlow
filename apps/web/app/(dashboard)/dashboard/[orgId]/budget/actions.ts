import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/api/client';
import { getCurrentUser } from '@/auth/session';
import { getMessages } from '@/i18n/messages';
import {
  budgetExchangeSchema,
  createBudgetMonthSchema,
  listBudgetQuerySchema,
  updateBudgetBaseCurrencySchema,
  updateBudgetEntryNoteSchema,
  updateBudgetOpeningBalanceSchema,
  type BudgetEntry,
  type BudgetEntryField,
  type BudgetExchangeInput,
  type BudgetMonth,
  type BudgetOpeningBalance,
  type BudgetPayload,
  type CreateBudgetMonthInput,
  type UpdateBudgetBaseCurrencyInput,
  type UpdateBudgetEntryInput,
  type UpdateBudgetEntryNoteInput,
  type UpdateBudgetOpeningBalanceInput,
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
  if (!parsed.success) {
    const messages = await currentBudgetMessages();
    return { ok: false, error: messages.invalidBudgetYear };
  }

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
  if (!parsed.success) {
    const messages = await currentBudgetMessages();
    return { ok: false, error: messages.invalidMonth };
  }

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
  if (!parsed.success) {
    const messages = await currentBudgetMessages();
    return { ok: false, error: messages.invalidNote };
  }

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

async function currentBudgetMessages() {
  const user = await getCurrentUser();
  return getMessages(user?.locale ?? 'en').budget;
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

export async function updateBudgetOpeningBalanceAction(
  organizationId: string,
  input: UpdateBudgetOpeningBalanceInput,
): Promise<ActionResult<BudgetOpeningBalance>> {
  'use server';
  const parsed = updateBudgetOpeningBalanceSchema.safeParse(input);
  if (!parsed.success) {
    const messages = await currentBudgetMessages();
    return { ok: false, error: messages.invalidOpeningBalance };
  }

  const result = await apiFetch<BudgetOpeningBalance>(
    `/organizations/${organizationId}/budget/opening-balance`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data),
    },
  );
  revalidatePath(budgetPath(organizationId));

  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error.message };
}

export async function updateBudgetBaseCurrencyAction(
  organizationId: string,
  input: UpdateBudgetBaseCurrencyInput,
): Promise<ActionResult<UpdateBudgetBaseCurrencyInput>> {
  'use server';
  const parsed = updateBudgetBaseCurrencySchema.safeParse(input);
  if (!parsed.success) {
    const messages = await currentBudgetMessages();
    return { ok: false, error: messages.invalidBaseCurrency };
  }

  const result = await apiFetch<UpdateBudgetBaseCurrencyInput>(
    `/organizations/${organizationId}/budget/base-currency`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data),
    },
  );
  revalidatePath(budgetPath(organizationId));

  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error.message };
}

export async function createBudgetExchangeAction(
  organizationId: string,
  monthId: string,
  input: BudgetExchangeInput,
): Promise<ActionResult<BudgetMonth>> {
  'use server';
  return saveBudgetExchange(
    organizationId,
    `/organizations/${organizationId}/budget/months/${monthId}/exchanges`,
    'POST',
    input,
  );
}

export async function updateBudgetExchangeAction(
  organizationId: string,
  exchangeId: string,
  input: BudgetExchangeInput,
): Promise<ActionResult<BudgetMonth>> {
  'use server';
  return saveBudgetExchange(
    organizationId,
    `/organizations/${organizationId}/budget/exchanges/${exchangeId}`,
    'PUT',
    input,
  );
}

export async function deleteBudgetExchangeAction(
  organizationId: string,
  exchangeId: string,
): Promise<ActionResult<BudgetMonth>> {
  'use server';
  const result = await apiFetch<BudgetMonth>(
    `/organizations/${organizationId}/budget/exchanges/${exchangeId}`,
    { method: 'DELETE' },
  );
  revalidatePath(budgetPath(organizationId));

  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error.message };
}

async function saveBudgetExchange(
  organizationId: string,
  path: string,
  method: 'POST' | 'PUT',
  input: BudgetExchangeInput,
): Promise<ActionResult<BudgetMonth>> {
  const parsed = budgetExchangeSchema.safeParse(input);
  if (!parsed.success) {
    const messages = await currentBudgetMessages();
    return { ok: false, error: messages.invalidExchange };
  }

  const result = await apiFetch<BudgetMonth>(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed.data),
  });
  revalidatePath(budgetPath(organizationId));

  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error.message };
}
