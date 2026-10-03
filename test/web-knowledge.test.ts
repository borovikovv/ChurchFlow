import assert from 'node:assert/strict';
import test from 'node:test';
import './support/web-module-hooks.ts';
import { monthNames, weekdayNames } from '../apps/web/src/lib/calendar-names.ts';

const KNOWLEDGE = '../apps/web/app/(dashboard)/dashboard/[orgId]/knowledge';
const {
  importantDatesRequestQuery,
  knowledgeEntriesRequestQuery,
  knowledgePreservedParams,
  parseKnowledgePageQuery,
} = await import(`${KNOWLEDGE}/knowledge-page-query.ts`);
const { formatCalendarDay, importantDateRuleParts } = await import(
  `${KNOWLEDGE}/important-date-format.ts`
);
const { knowledgeNoteFormSchema, parseTagsText, ruleFieldsFor, optionalNumber } = await import(
  `${KNOWLEDGE}/knowledge-forms.ts`
);

test('the page reads its view and filters from the URL and drops what is not valid', () => {
  assert.deepEqual(
    parseKnowledgePageQuery({
      view: 'dates',
      search: '  Communion ',
      category: 'TRADITION',
      tag: 'Kids',
      pinned: 'true',
    }),
    { view: 'dates', search: 'Communion', category: 'TRADITION', tag: 'kids', pinned: 'true' },
  );
  assert.deepEqual(
    parseKnowledgePageQuery({
      view: 'secret',
      category: 'SECRET',
      pinned: 'yes',
      search: ['a', 'b'],
    }),
    { view: 'notes', search: 'a', category: '', tag: '', pinned: '' },
  );
});

test('only the filters that are set reach the API, with search sent as q', () => {
  const query = parseKnowledgePageQuery({ search: 'easter', pinned: 'false' });

  assert.equal(knowledgeEntriesRequestQuery(query).toString(), 'q=easter&pinned=false');
  assert.equal(knowledgeEntriesRequestQuery(parseKnowledgePageQuery({})).toString(), '');
  assert.equal(
    importantDatesRequestQuery(parseKnowledgePageQuery({ search: 'easter', tag: 'x' })).toString(),
    'q=easter',
  );
});

test('a filter control keeps the others', () => {
  assert.deepEqual(
    knowledgePreservedParams(parseKnowledgePageQuery({ view: 'dates', tag: 'kids' })),
    {
      view: 'dates',
      search: undefined,
      category: undefined,
      tag: 'kids',
      pinned: undefined,
    },
  );
});

test('a weekday rule is described by keys each language words itself', () => {
  assert.deepEqual(
    importantDateRuleParts('uk', {
      ruleKind: 'NTH_WEEKDAY',
      month: 10,
      day: null,
      weekday: 0,
      nth: 1,
    }),
    { kind: 'nthWeekday', ordinal: 'first', weekday: 'sunday', month: 'жовтня' },
  );
  assert.deepEqual(
    importantDateRuleParts('en', {
      ruleKind: 'NTH_WEEKDAY',
      month: 5,
      day: null,
      weekday: 1,
      nth: -1,
    }),
    { kind: 'nthWeekday', ordinal: 'last', weekday: 'monday', month: 'May' },
  );
  assert.deepEqual(
    importantDateRuleParts('en', {
      ruleKind: 'FIXED',
      month: 2,
      day: 29,
      weekday: null,
      nth: null,
    }),
    { kind: 'fixed', dayAndMonth: 'February 29' },
  );
  assert.equal(
    importantDateRuleParts('en', {
      ruleKind: 'FIXED',
      month: 2,
      day: null,
      weekday: null,
      nth: null,
    }),
    null,
  );
});

test('pickers name months from January and weekdays from Sunday', () => {
  assert.equal(monthNames('en')[0], 'January');
  assert.equal(monthNames('en').length, 12);
  assert.equal(weekdayNames('en')[0], 'Sunday');
  assert.equal(weekdayNames('en')[6], 'Saturday');
});

test('the next date is a calendar day, not shifted by the time zone', () => {
  assert.equal(formatCalendarDay('en-US', '2026-10-04'), 'Oct 4, 2026');
});

test('tags are typed as one line and stored lower-cased without repeats', () => {
  assert.deepEqual(parseTagsText(' Kids, youth ,, kids '), ['Kids', 'youth', 'kids']);
  const parsed = knowledgeNoteFormSchema.parse({
    title: 'Communion',
    content: '<p>First Sunday</p>',
    category: 'TRADITION',
    tags: 'Bread, wine, bread',
    pinned: false,
    visibility: 'MEMBERS',
  });
  assert.deepEqual(parsed.tags, ['bread', 'wine']);
});

test('switching the rule kind fills what the new kind needs', () => {
  assert.deepEqual(ruleFieldsFor('FIXED'), { day: 1, weekday: null, nth: null });
  assert.deepEqual(ruleFieldsFor('NTH_WEEKDAY'), { day: null, weekday: 0, nth: 1 });
  assert.equal(optionalNumber(''), null);
  assert.equal(optionalNumber('3'), 3);
  assert.equal(optionalNumber('-1'), -1);
});
