const assert = require('node:assert/strict');
const test = require('node:test');
const { BudgetsRepository } = require('../dist/modules/budgets/repositories/budgets.repository');

const ORGANIZATION_ID = 'organization-a';
const OTHER_ORGANIZATION_ID = 'organization-b';
const ACTOR_USER_ID = 'actor';
const MONTH_ID = 'month';
const CATEGORY_ID = 'category';
const ROW_COUNT = 10;

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (value !== null && typeof value === 'object') {
      return Array.isArray(value.in) ? value.in.includes(row[key]) : true;
    }
    return row[key] === value;
  });
}

function findFirst(rows) {
  return async ({ where }) => rows.find((row) => matches(row, where)) ?? null;
}

function budgetTransaction(options = {}) {
  const {
    actorOrganizationId = ORGANIZATION_ID,
    monthOrganizationId = ORGANIZATION_ID,
    categoryOrganizationId = ORGANIZATION_ID,
  } = options;

  const writes = [];
  const write = (operation) => async (args) => {
    writes.push({ operation, args });
    return { id: 'entry', count: Array.isArray(args.data) ? args.data.length : 1 };
  };

  const memberRows = [
    {
      id: 'membership',
      organizationId: actorOrganizationId,
      userId: ACTOR_USER_ID,
      role: 'OWNER',
      status: 'ACTIVE',
      removedAt: null,
    },
  ];
  const monthRows = [
    {
      id: MONTH_ID,
      organizationId: monthOrganizationId,
      rowCount: ROW_COUNT,
      year: 2026,
      month: 8,
    },
  ];
  const categoryRows = [
    { id: CATEGORY_ID, organizationId: categoryOrganizationId, name: 'Tithes', deletedAt: null },
  ];

  const tx = {
    organizationMember: { findFirst: findFirst(memberRows) },
    budgetMonth: {
      findFirst: findFirst(monthRows),
      findUniqueOrThrow: async () => ({ id: MONTH_ID, entries: [] }),
      update: write('budgetMonth.update'),
    },
    budgetCategory: {
      findFirst: findFirst(categoryRows),
      findMany: async ({ where }) => categoryRows.filter((row) => matches(row, where)),
    },
    budgetEntry: {
      findUnique: async () => null,
      findUniqueOrThrow: async () => ({ id: 'entry', category: {}, notes: [] }),
      upsert: async (args) => {
        writes.push({ operation: 'budgetEntry.upsert', args });
        return { id: 'entry', category: {}, notes: [] };
      },
      createMany: write('budgetEntry.createMany'),
      deleteMany: write('budgetEntry.deleteMany'),
    },
    budgetEntryNote: {
      findUnique: async () => null,
      upsert: write('budgetEntryNote.upsert'),
      deleteMany: write('budgetEntryNote.deleteMany'),
    },
    auditLog: { create: write('auditLog.create') },
  };

  return { prisma: { $transaction: async (callback) => callback(tx) }, writes };
}

test('entry update refuses a month owned by another organization', async () => {
  const { prisma, writes } = budgetTransaction({ monthOrganizationId: OTHER_ORGANIZATION_ID });
  const repository = new BudgetsRepository(prisma);

  await assert.rejects(
    repository.updateEntry(ORGANIZATION_ID, MONTH_ID, CATEGORY_ID, 0, { amountUah: 10 }, ACTOR_USER_ID),
    /BUDGET_MONTH_NOT_FOUND/,
  );
  assert.deepEqual(writes, []);
});

test('entry update refuses a category owned by another organization', async () => {
  const { prisma, writes } = budgetTransaction({ categoryOrganizationId: OTHER_ORGANIZATION_ID });
  const repository = new BudgetsRepository(prisma);

  await assert.rejects(
    repository.updateEntry(ORGANIZATION_ID, MONTH_ID, CATEGORY_ID, 0, { amountUah: 10 }, ACTOR_USER_ID),
    /BUDGET_CATEGORY_NOT_FOUND/,
  );
  assert.deepEqual(writes, []);
});

test('entry update refuses a row index outside the month row count', async () => {
  const { prisma, writes } = budgetTransaction();
  const repository = new BudgetsRepository(prisma);

  await assert.rejects(
    repository.updateEntry(ORGANIZATION_ID, MONTH_ID, CATEGORY_ID, ROW_COUNT, { amountUah: 10 }, ACTOR_USER_ID),
    /BUDGET_MONTH_ROW_NOT_FOUND/,
  );
  await assert.rejects(
    repository.updateEntry(ORGANIZATION_ID, MONTH_ID, CATEGORY_ID, -1, { amountUah: 10 }, ACTOR_USER_ID),
    /BUDGET_MONTH_ROW_NOT_FOUND/,
  );
  assert.deepEqual(writes, []);
});

test('entry update refuses an actor who cannot manage the budget', async () => {
  const { prisma, writes } = budgetTransaction({ actorOrganizationId: OTHER_ORGANIZATION_ID });
  const repository = new BudgetsRepository(prisma);

  await assert.rejects(
    repository.updateEntry(ORGANIZATION_ID, MONTH_ID, CATEGORY_ID, 0, { amountUah: 10 }, ACTOR_USER_ID),
    /ACTOR_CANNOT_MANAGE_BUDGET/,
  );
  assert.deepEqual(writes, []);
});

test('entry update identifies the cell by month, category and row index', async () => {
  const { prisma, writes } = budgetTransaction();
  const repository = new BudgetsRepository(prisma);

  await repository.updateEntry(ORGANIZATION_ID, MONTH_ID, CATEGORY_ID, 3, { amountUah: 250 }, ACTOR_USER_ID);

  const upsert = writes.find((entry) => entry.operation === 'budgetEntry.upsert');
  assert.ok(upsert);
  assert.deepEqual(upsert.args.where, {
    monthId_categoryId_rowIndex: { monthId: MONTH_ID, categoryId: CATEGORY_ID, rowIndex: 3 },
  });
  assert.equal(upsert.args.create.monthId, MONTH_ID);
  assert.equal(upsert.args.create.categoryId, CATEGORY_ID);
  assert.equal(upsert.args.create.rowIndex, 3);
  assert.equal(upsert.args.create.organizationId, ORGANIZATION_ID);
});

test('entry note update runs the same ownership checks as the entry itself', async () => {
  const { prisma, writes } = budgetTransaction({ categoryOrganizationId: OTHER_ORGANIZATION_ID });
  const repository = new BudgetsRepository(prisma);

  await assert.rejects(
    repository.updateEntryNote(
      ORGANIZATION_ID,
      MONTH_ID,
      CATEGORY_ID,
      0,
      'AMOUNT_UAH',
      { note: 'anything' },
      ACTOR_USER_ID,
    ),
    /BUDGET_CATEGORY_NOT_FOUND/,
  );
  assert.deepEqual(writes, []);
});

test('adding a month row seeds one entry per category of that organization', async () => {
  const { prisma, writes } = budgetTransaction();
  const repository = new BudgetsRepository(prisma);

  await repository.addMonthRow(ORGANIZATION_ID, MONTH_ID, ACTOR_USER_ID);

  const createMany = writes.find((entry) => entry.operation === 'budgetEntry.createMany');
  assert.ok(createMany);
  assert.deepEqual(createMany.args.data, [
    {
      monthId: MONTH_ID,
      categoryId: CATEGORY_ID,
      rowIndex: ROW_COUNT,
      organizationId: ORGANIZATION_ID,
    },
  ]);
});

test('adding a month row refuses a month owned by another organization', async () => {
  const { prisma, writes } = budgetTransaction({ monthOrganizationId: OTHER_ORGANIZATION_ID });
  const repository = new BudgetsRepository(prisma);

  await assert.rejects(
    repository.addMonthRow(ORGANIZATION_ID, MONTH_ID, ACTOR_USER_ID),
    /BUDGET_MONTH_NOT_FOUND/,
  );
  assert.deepEqual(writes, []);
});
