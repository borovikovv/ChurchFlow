const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildBudgetAmountChanges,
  changedCategoryFields,
} = require('../dist/modules/budgets/budget-audit-metadata');

const CATEGORY = { name: 'Tithes', type: 'INCOME', order: 2 };

function decimal(value) {
  return { toString: () => value };
}

test('records only the amount fields present in the patch', () => {
  const changes = buildBudgetAmountChanges(
    { amountUah: decimal('100.00'), amountUsd: decimal('0.00'), amountEur: decimal('0.00') },
    { amountUah: 250 },
  );

  assert.deepEqual(changes, [{ field: 'amountUah', from: '100.00', to: '250.00' }]);
});

test('ignores amounts that did not change numerically', () => {
  const changes = buildBudgetAmountChanges({ amountUah: decimal('100.00') }, { amountUah: 100 });

  assert.deepEqual(changes, []);
});

test('treats a missing entry as zero', () => {
  const changes = buildBudgetAmountChanges(null, { amountEur: 42.5 });

  assert.deepEqual(changes, [{ field: 'amountEur', from: '0.00', to: '42.50' }]);
});

test('records every changed currency of a multi field patch', () => {
  const changes = buildBudgetAmountChanges(
    { amountUah: decimal('10.00'), amountUsd: decimal('5.00'), amountEur: decimal('1.00') },
    { amountUah: 10, amountUsd: 7, amountEur: 0 },
  );

  assert.deepEqual(changes, [
    { field: 'amountUsd', from: '5.00', to: '7.00' },
    { field: 'amountEur', from: '1.00', to: '0.00' },
  ]);
});

test('category diff reports nothing when the submitted values are identical', () => {
  assert.deepEqual(
    changedCategoryFields(CATEGORY, { name: 'Tithes', type: 'INCOME', order: 2 }),
    [],
  );
});

test('category diff reports only the fields that actually changed', () => {
  assert.deepEqual(changedCategoryFields(CATEGORY, { name: 'Tithes', order: 5 }), ['order']);
});

test('category diff skips fields missing from the patch', () => {
  assert.deepEqual(changedCategoryFields(CATEGORY, { name: 'Offerings', type: undefined }), [
    'name',
  ]);
});

test('category diff reports every changed field at once', () => {
  assert.deepEqual(
    changedCategoryFields(CATEGORY, { name: 'Offerings', type: 'EXPENSE', order: 0 }),
    ['name', 'type', 'order'],
  );
});
