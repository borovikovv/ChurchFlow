const assert = require('node:assert/strict');
const test = require('node:test');
const { BudgetsRepository } = require('../dist/modules/budgets/repositories/budgets.repository');

const ORGANIZATION_ID = 'organization';
const ACTOR_USER_ID = 'actor';
const MONTH_ID = 'month';
const CATEGORY_ID = 'category';

function decimal(value) {
  return { toString: () => value };
}

function entryTransaction(previousAmounts) {
  const auditRows = [];
  const upserts = [];
  const tx = {
    organizationMember: { findFirst: async () => ({ id: 'membership' }) },
    budgetMonth: {
      findFirst: async () => ({ id: MONTH_ID, rowCount: 10, year: 2026, month: 8 }),
    },
    budgetCategory: { findFirst: async () => ({ id: CATEGORY_ID, name: 'Tithes' }) },
    budgetEntry: {
      findUnique: async () => previousAmounts,
      upsert: async (args) => {
        upserts.push(args);
        return { id: 'entry', category: {}, notes: [] };
      },
    },
    auditLog: {
      create: async (args) => {
        auditRows.push(args.data);
        return args.data;
      },
    },
  };

  return { prisma: { $transaction: async (callback) => callback(tx) }, auditRows, upserts };
}

test('budget cell update records the previous and the new amount', async () => {
  const { prisma, auditRows } = entryTransaction({
    amountUah: decimal('100.00'),
    amountUsd: decimal('0.00'),
    amountEur: decimal('0.00'),
  });
  const repository = new BudgetsRepository(prisma);

  await repository.updateEntry(
    ORGANIZATION_ID,
    MONTH_ID,
    CATEGORY_ID,
    3,
    { amountUah: 250 },
    ACTOR_USER_ID,
  );

  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].action, 'UPDATE_BUDGET_ENTRY');
  assert.equal(auditRows[0].entityType, 'Budget');
  assert.equal(auditRows[0].actorUserId, ACTOR_USER_ID);
  assert.deepEqual(auditRows[0].metadata, {
    year: 2026,
    month: 8,
    categoryId: CATEGORY_ID,
    categoryName: 'Tithes',
    rowIndex: 3,
    changes: [{ field: 'amountUah', from: '100.00', to: '250.00' }],
  });
});

test('budget cell update still persists but records nothing when the amount is unchanged', async () => {
  const { prisma, auditRows, upserts } = entryTransaction({
    amountUah: decimal('100.00'),
    amountUsd: decimal('0.00'),
    amountEur: decimal('0.00'),
  });
  const repository = new BudgetsRepository(prisma);

  await repository.updateEntry(
    ORGANIZATION_ID,
    MONTH_ID,
    CATEGORY_ID,
    3,
    { amountUah: 100 },
    ACTOR_USER_ID,
  );

  assert.equal(upserts.length, 1);
  assert.equal(auditRows.length, 0);
});

function categoryTransaction() {
  const auditRows = [];
  const updates = [];
  const tx = {
    organizationMember: { findFirst: async () => ({ id: 'membership' }) },
    budgetCategory: {
      findFirst: async () => ({ id: CATEGORY_ID, name: 'Tithes', type: 'INCOME', order: 2 }),
      update: async (args) => {
        updates.push(args);
        return { id: CATEGORY_ID, name: args.data.name ?? 'Tithes' };
      },
    },
    auditLog: {
      create: async (args) => {
        auditRows.push(args.data);
        return args.data;
      },
    },
  };

  return { prisma: { $transaction: async (callback) => callback(tx) }, auditRows, updates };
}

test('category update records nothing when the submitted values match the stored ones', async () => {
  const { prisma, auditRows, updates } = categoryTransaction();
  const repository = new BudgetsRepository(prisma);

  await repository.updateCategory(
    ORGANIZATION_ID,
    CATEGORY_ID,
    { name: 'Tithes', type: 'INCOME', order: 2 },
    ACTOR_USER_ID,
  );

  assert.equal(updates.length, 1);
  assert.equal(auditRows.length, 0);
});

test('category update records only the fields that actually changed', async () => {
  const { prisma, auditRows } = categoryTransaction();
  const repository = new BudgetsRepository(prisma);

  await repository.updateCategory(
    ORGANIZATION_ID,
    CATEGORY_ID,
    { name: 'Offerings', type: 'INCOME', order: 2 },
    ACTOR_USER_ID,
  );

  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].action, 'UPDATE_BUDGET_CATEGORY');
  assert.deepEqual(auditRows[0].metadata, { name: 'Offerings', changedFields: ['name'] });
});
