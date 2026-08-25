import { BUDGET_AMOUNT_FIELDS, type BudgetAmountField } from '@churchflow/shared';

export const BUDGET_AUDIT_ENTITY_TYPE = 'Budget';

export type BudgetAmountChange = {
  field: BudgetAmountField;
  from: string;
  to: string;
};

type AmountValue = { toString(): string } | number | null | undefined;

type AmountSource = Partial<Record<BudgetAmountField, AmountValue>>;

type AmountPatch = Partial<Record<BudgetAmountField, number>>;

export function buildBudgetAmountChanges(
  previous: AmountSource | null,
  patch: AmountPatch,
): BudgetAmountChange[] {
  const changes: BudgetAmountChange[] = [];

  for (const field of BUDGET_AMOUNT_FIELDS) {
    const next = patch[field];
    if (next === undefined) continue;

    const from = toAmountNumber(previous?.[field]);
    const to = toAmountNumber(next);
    if (from === to) continue;

    changes.push({ field, from: formatAmount(from), to: formatAmount(to) });
  }

  return changes;
}

export function changedCategoryFields(
  previous: { name: string; type: string; order: number },
  input: { name?: string | undefined; type?: string | undefined; order?: number | undefined },
): string[] {
  const changed: string[] = [];

  if (input.name !== undefined && input.name !== previous.name) changed.push('name');
  if (input.type !== undefined && input.type !== previous.type) changed.push('type');
  if (input.order !== undefined && input.order !== previous.order) changed.push('order');

  return changed;
}

function toAmountNumber(value: AmountValue): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmount(value: number): string {
  return value.toFixed(2);
}
