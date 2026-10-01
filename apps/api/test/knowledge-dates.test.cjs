const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createImportantDateSchema,
  createKnowledgeEntrySchema,
  importantDateOccurrencesBetween,
  importantDateRuleOf,
  listKnowledgeEntriesQuerySchema,
  nextImportantDateOccurrence,
  resolveImportantDate,
  updateImportantDateSchema,
} = require('@churchflow/shared');

const THANKSGIVING = { ruleKind: 'NTH_WEEKDAY', month: 10, weekday: 0, nth: 1 };

test('the first Sunday of October 2026 is the 4th', () => {
  assert.equal(resolveImportantDate(THANKSGIVING, 2026), '2026-10-04');
  assert.equal(resolveImportantDate(THANKSGIVING, 2027), '2027-10-03');
});

test('an nth weekday that falls on the first of the month is counted from it', () => {
  // 1 November 2026 is a Sunday.
  assert.equal(
    resolveImportantDate({ ruleKind: 'NTH_WEEKDAY', month: 11, weekday: 0, nth: 1 }, 2026),
    '2026-11-01',
  );
  assert.equal(
    resolveImportantDate({ ruleKind: 'NTH_WEEKDAY', month: 11, weekday: 0, nth: 4 }, 2026),
    '2026-11-22',
  );
});

test('the last weekday of a month counts back from its last day', () => {
  // Memorial Day: the last Monday of May.
  const lastMonday = { ruleKind: 'NTH_WEEKDAY', month: 5, weekday: 1, nth: -1 };
  assert.equal(resolveImportantDate(lastMonday, 2026), '2026-05-25');
  // 31 August 2026 is a Monday, so the last Monday is the last day itself.
  assert.equal(
    resolveImportantDate({ ruleKind: 'NTH_WEEKDAY', month: 8, weekday: 1, nth: -1 }, 2026),
    '2026-08-31',
  );
  // The last Sunday of February in a leap year.
  assert.equal(
    resolveImportantDate({ ruleKind: 'NTH_WEEKDAY', month: 2, weekday: 0, nth: -1 }, 2028),
    '2028-02-27',
  );
});

test('29 February falls on 28 February in a year without one', () => {
  const leapDay = { ruleKind: 'FIXED', month: 2, day: 29 };
  assert.equal(resolveImportantDate(leapDay, 2028), '2028-02-29');
  assert.equal(resolveImportantDate(leapDay, 2027), '2027-02-28');
  assert.equal(resolveImportantDate({ ruleKind: 'FIXED', month: 1, day: 7 }, 2027), '2027-01-07');
});

test('the next occurrence includes today and otherwise moves to next year', () => {
  assert.equal(nextImportantDateOccurrence(THANKSGIVING, '2026-10-04'), '2026-10-04');
  assert.equal(nextImportantDateOccurrence(THANKSGIVING, '2026-10-05'), '2027-10-03');
  assert.equal(nextImportantDateOccurrence(THANKSGIVING, '2026-01-01'), '2026-10-04');
});

test('occurrences in a range cover each year it touches', () => {
  assert.deepEqual(importantDateOccurrencesBetween(THANKSGIVING, '2026-01-01', '2027-12-31'), [
    '2026-10-04',
    '2027-10-03',
  ]);
  assert.deepEqual(importantDateOccurrencesBetween(THANKSGIVING, '2026-10-05', '2027-06-01'), []);
});

test('stored columns that do not form a rule are reported as no rule', () => {
  assert.equal(
    importantDateRuleOf({ ruleKind: 'FIXED', month: 1, day: null, weekday: null, nth: null }),
    null,
  );
  assert.deepEqual(
    importantDateRuleOf({ ruleKind: 'NTH_WEEKDAY', month: 10, day: null, weekday: 0, nth: 1 }),
    THANKSGIVING,
  );
});

test('a fixed date needs a day that exists in its month', () => {
  assert.equal(
    createImportantDateSchema.safeParse({ title: 'Leap', ruleKind: 'FIXED', month: 2, day: 29 })
      .success,
    true,
  );
  for (const input of [
    { title: 'No day', ruleKind: 'FIXED', month: 2 },
    { title: 'Too late', ruleKind: 'FIXED', month: 2, day: 30 },
    { title: 'April', ruleKind: 'FIXED', month: 4, day: 31 },
    { title: 'Mixed', ruleKind: 'FIXED', month: 4, day: 1, weekday: 0 },
  ]) {
    assert.equal(createImportantDateSchema.safeParse(input).success, false, input.title);
  }
});

test('a weekday rule needs a weekday and an occurrence of 1-4 or -1', () => {
  assert.equal(
    createImportantDateSchema.safeParse({ title: 'Thanksgiving', ...THANKSGIVING }).success,
    true,
  );
  for (const input of [
    { title: 'No weekday', ruleKind: 'NTH_WEEKDAY', month: 10, nth: 1 },
    { title: 'No nth', ruleKind: 'NTH_WEEKDAY', month: 10, weekday: 0 },
    { title: 'Fifth', ruleKind: 'NTH_WEEKDAY', month: 10, weekday: 0, nth: 5 },
    { title: 'With day', ...THANKSGIVING, day: 4 },
    { title: 'Month 13', ...THANKSGIVING, month: 13 },
  ]) {
    assert.equal(createImportantDateSchema.safeParse(input).success, false, input.title);
  }
});

test('an update changes the rule only as a whole', () => {
  assert.equal(updateImportantDateSchema.safeParse({ title: 'Renamed' }).success, true);
  assert.equal(updateImportantDateSchema.safeParse({ month: 11 }).success, false);
  assert.equal(
    updateImportantDateSchema.safeParse({ ruleKind: 'FIXED', month: 11, day: 1 }).success,
    true,
  );
  assert.equal(updateImportantDateSchema.safeParse({}).success, false);
});

test('a note keeps its tags lower-cased and without repeats', () => {
  const parsed = createKnowledgeEntrySchema.parse({
    title: 'Communion',
    content: '<p>First Sunday</p>',
    tags: ['Communion', ' communion ', 'Bread'],
  });

  assert.deepEqual(parsed.tags, ['communion', 'bread']);
  assert.equal(parsed.category, 'OTHER');
  assert.equal(parsed.visibility, 'MEMBERS');
  assert.equal(parsed.pinned, false);
  assert.equal(
    createKnowledgeEntrySchema.safeParse({ title: 'Secret', content: 'x', visibility: 'AI_ONLY' })
      .success,
    false,
  );
});

test('the list query accepts only known filters', () => {
  assert.deepEqual(
    listKnowledgeEntriesQuerySchema.parse({ q: '  ', pinned: 'true', tag: 'Kids' }),
    {
      q: undefined,
      tag: 'kids',
      pinned: true,
    },
  );
  assert.equal(listKnowledgeEntriesQuerySchema.safeParse({ category: 'SECRET' }).success, false);
  assert.equal(listKnowledgeEntriesQuerySchema.safeParse({ pinned: 'yes' }).success, false);
});
