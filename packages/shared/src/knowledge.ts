import { z } from 'zod';

export const KNOWLEDGE_CATEGORIES = [
  'TRADITION',
  'INSTRUCTION',
  'AGREEMENT',
  'MINISTRY',
  'THEOLOGY',
  'OTHER',
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

/** Who can read a note or a date: every member, the people who run the church, or the owner. */
export const KNOWLEDGE_VISIBILITIES = ['MEMBERS', 'ADMINS', 'OWNER'] as const;

export type KnowledgeVisibility = (typeof KNOWLEDGE_VISIBILITIES)[number];

export const IMPORTANT_DATE_RULE_KINDS = ['FIXED', 'NTH_WEEKDAY'] as const;

export type ImportantDateRuleKind = (typeof IMPORTANT_DATE_RULE_KINDS)[number];

/** Which occurrence of the weekday in the month: the first to the fourth, or -1 for the last. */
export const IMPORTANT_DATE_NTH_VALUES = [1, 2, 3, 4, -1] as const;

export type ImportantDateNth = (typeof IMPORTANT_DATE_NTH_VALUES)[number];

export const KNOWLEDGE_TITLE_MAX_LENGTH = 160;
export const KNOWLEDGE_CONTENT_MAX_LENGTH = 20000;
export const KNOWLEDGE_TAG_MAX_LENGTH = 40;
export const KNOWLEDGE_TAGS_MAX_COUNT = 10;
export const KNOWLEDGE_SEARCH_MAX_LENGTH = 100;
export const IMPORTANT_DATE_NOTES_MAX_LENGTH = 2000;
export const IMPORTANT_DATE_REMINDER_MAX_DAYS = 60;

const title = z.string().trim().min(2).max(KNOWLEDGE_TITLE_MAX_LENGTH);

/** Tags are matched exactly, so they are stored trimmed, lower-cased and without repeats. */
const tags = z
  .array(z.string().trim().min(1).max(KNOWLEDGE_TAG_MAX_LENGTH))
  .max(KNOWLEDGE_TAGS_MAX_COUNT)
  .transform((values) => [...new Set(values.map((value) => value.toLowerCase()))]);

const knowledgeEntryFields = {
  title,
  content: z.string().trim().min(1).max(KNOWLEDGE_CONTENT_MAX_LENGTH),
  category: z.enum(KNOWLEDGE_CATEGORIES),
  tags,
  pinned: z.boolean(),
  visibility: z.enum(KNOWLEDGE_VISIBILITIES),
};

export const createKnowledgeEntrySchema = z.object({
  title: knowledgeEntryFields.title,
  content: knowledgeEntryFields.content,
  category: knowledgeEntryFields.category.default('OTHER'),
  tags: knowledgeEntryFields.tags.default([]),
  pinned: knowledgeEntryFields.pinned.default(false),
  visibility: knowledgeEntryFields.visibility.default('MEMBERS'),
});

export const updateKnowledgeEntrySchema = z
  .object({
    title: knowledgeEntryFields.title.optional(),
    content: knowledgeEntryFields.content.optional(),
    category: knowledgeEntryFields.category.optional(),
    tags: knowledgeEntryFields.tags.optional(),
    pinned: knowledgeEntryFields.pinned.optional(),
    visibility: knowledgeEntryFields.visibility.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one knowledge entry field is required',
  });

const optionalSearch = z
  .string()
  .trim()
  .max(KNOWLEDGE_SEARCH_MAX_LENGTH)
  .optional()
  .transform((value) => (value === '' ? undefined : value));

export const listKnowledgeEntriesQuerySchema = z.object({
  q: optionalSearch,
  category: z.enum(KNOWLEDGE_CATEGORIES).optional(),
  tag: z
    .string()
    .trim()
    .max(KNOWLEDGE_TAG_MAX_LENGTH)
    .optional()
    .transform((value) => (value ? value.toLowerCase() : undefined)),
  pinned: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const listImportantDatesQuerySchema = z.object({
  q: optionalSearch,
});

export type CreateKnowledgeEntryInput = z.infer<typeof createKnowledgeEntrySchema>;
export type UpdateKnowledgeEntryInput = z.infer<typeof updateKnowledgeEntrySchema>;
export type ListKnowledgeEntriesQuery = z.infer<typeof listKnowledgeEntriesQuerySchema>;
export type ListKnowledgeEntriesQueryInput = z.input<typeof listKnowledgeEntriesQuerySchema>;
export type ListImportantDatesQuery = z.infer<typeof listImportantDatesQuerySchema>;

/** Days in each month of a leap year, so a FIXED rule may name 29 February. */
const MAX_DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const ruleFields = {
  ruleKind: z.enum(IMPORTANT_DATE_RULE_KINDS),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31).nullable(),
  weekday: z.number().int().min(0).max(6).nullable(),
  nth: z
    .number()
    .int()
    .refine((value): value is ImportantDateNth =>
      IMPORTANT_DATE_NTH_VALUES.some((allowed) => allowed === value),
    )
    .nullable(),
};

const importantDateFields = {
  title,
  notes: z
    .string()
    .trim()
    .max(IMPORTANT_DATE_NOTES_MAX_LENGTH)
    .nullable()
    .transform((value) => (value === '' ? null : value)),
  reminderLeadDays: z.number().int().min(0).max(IMPORTANT_DATE_REMINDER_MAX_DAYS).nullable(),
  visibility: z.enum(KNOWLEDGE_VISIBILITIES),
};

interface ImportantDateRuleFields {
  ruleKind?: ImportantDateRuleKind | undefined;
  month?: number | undefined;
  day?: number | null | undefined;
  weekday?: number | null | undefined;
  nth?: number | null | undefined;
}

const RULE_FIELD_NAMES = ['month', 'day', 'weekday', 'nth'] as const;

/** Shared by the schemas here and by any caller that builds its own input shape for a rule. */
export function refineImportantDateRule(value: ImportantDateRuleFields, context: z.RefinementCtx) {
  if (value.ruleKind === undefined) {
    // An update that leaves the rule alone may skip it; one that changes it sends all of it.
    for (const field of RULE_FIELD_NAMES) {
      if (value[field] !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ruleKind'],
          message: 'ruleKind is required when the date rule changes',
        });
        return;
      }
    }
    return;
  }

  if (value.month === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['month'],
      message: 'Month is required',
    });
    return;
  }

  if (value.ruleKind === 'FIXED') {
    const maxDay = MAX_DAYS_IN_MONTH[value.month - 1] ?? 31;
    if (value.day === undefined || value.day === null || value.day > maxDay) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['day'],
        message: 'A fixed date needs a day that exists in its month',
      });
    }
    if (isSet(value.weekday) || isSet(value.nth)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weekday'],
        message: 'A fixed date has no weekday or occurrence',
      });
    }
    return;
  }

  if (!isSet(value.weekday)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['weekday'],
      message: 'A weekday rule needs a weekday',
    });
  }
  if (!isSet(value.nth)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['nth'],
      message: 'A weekday rule needs an occurrence',
    });
  }
  if (isSet(value.day)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['day'],
      message: 'A weekday rule has no day of the month',
    });
  }
}

function isSet(value: number | null | undefined): value is number {
  return value !== undefined && value !== null;
}

export const createImportantDateSchema = z
  .object({
    title: importantDateFields.title,
    notes: importantDateFields.notes.optional().transform((value) => value ?? null),
    ruleKind: ruleFields.ruleKind,
    month: ruleFields.month,
    day: ruleFields.day.optional().transform((value) => value ?? null),
    weekday: ruleFields.weekday.optional().transform((value) => value ?? null),
    nth: ruleFields.nth.optional().transform((value) => value ?? null),
    reminderLeadDays: importantDateFields.reminderLeadDays
      .optional()
      .transform((value) => value ?? null),
    visibility: importantDateFields.visibility.default('MEMBERS'),
  })
  .superRefine(refineImportantDateRule);

export const updateImportantDateSchema = z
  .object({
    title: importantDateFields.title.optional(),
    notes: importantDateFields.notes.optional(),
    ruleKind: ruleFields.ruleKind.optional(),
    month: ruleFields.month.optional(),
    day: ruleFields.day.optional(),
    weekday: ruleFields.weekday.optional(),
    nth: ruleFields.nth.optional(),
    reminderLeadDays: importantDateFields.reminderLeadDays.optional(),
    visibility: importantDateFields.visibility.optional(),
  })
  .superRefine(refineImportantDateRule)
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one important date field is required',
  });

export type CreateImportantDateInput = z.infer<typeof createImportantDateSchema>;
export type CreateImportantDateFormInput = z.input<typeof createImportantDateSchema>;
export type UpdateImportantDateInput = z.infer<typeof updateImportantDateSchema>;

export type ImportantDateRule =
  | { ruleKind: 'FIXED'; month: number; day: number }
  | { ruleKind: 'NTH_WEEKDAY'; month: number; weekday: number; nth: number };

/** The rule stored as nullable columns, or null when the columns do not form a valid rule. */
export function importantDateRuleOf(fields: {
  ruleKind: ImportantDateRuleKind;
  month: number;
  day: number | null;
  weekday: number | null;
  nth: number | null;
}): ImportantDateRule | null {
  if (fields.ruleKind === 'FIXED') {
    return fields.day === null ? null : { ruleKind: 'FIXED', month: fields.month, day: fields.day };
  }

  return fields.weekday === null || fields.nth === null
    ? null
    : { ruleKind: 'NTH_WEEKDAY', month: fields.month, weekday: fields.weekday, nth: fields.nth };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * The calendar date a rule falls on in a given year, as YYYY-MM-DD. A FIXED 29 February falls on
 * 28 February in a year without one, so the date is still kept every year and stays in February.
 */
export function resolveImportantDate(rule: ImportantDateRule, year: number): string {
  const lastDay = daysInMonth(year, rule.month);

  if (rule.ruleKind === 'FIXED') {
    return isoDate(year, rule.month, Math.min(rule.day, lastDay));
  }

  if (rule.nth === -1) {
    const lastWeekday = new Date(Date.UTC(year, rule.month - 1, lastDay)).getUTCDay();
    return isoDate(year, rule.month, lastDay - ((lastWeekday - rule.weekday + 7) % 7));
  }

  const firstWeekday = new Date(Date.UTC(year, rule.month - 1, 1)).getUTCDay();
  const firstOccurrence = 1 + ((rule.weekday - firstWeekday + 7) % 7);

  return isoDate(year, rule.month, firstOccurrence + (rule.nth - 1) * 7);
}

/** The first date on or after `fromDate` (YYYY-MM-DD) that the rule falls on. */
export function nextImportantDateOccurrence(rule: ImportantDateRule, fromDate: string): string {
  const year = Number(fromDate.slice(0, 4));
  const thisYear = resolveImportantDate(rule, year);

  return thisYear >= fromDate ? thisYear : resolveImportantDate(rule, year + 1);
}

/** Every date from `fromDate` to `toDate` inclusive (both YYYY-MM-DD) that the rule falls on. */
export function importantDateOccurrencesBetween(
  rule: ImportantDateRule,
  fromDate: string,
  toDate: string,
): string[] {
  const occurrences: string[] = [];
  for (let year = Number(fromDate.slice(0, 4)); year <= Number(toDate.slice(0, 4)); year += 1) {
    const date = resolveImportantDate(rule, year);
    if (date >= fromDate && date <= toDate) occurrences.push(date);
  }

  return occurrences;
}

export interface KnowledgeAuthor {
  userId: string;
  displayName: string;
}

export interface KnowledgeEntryItem {
  id: string;
  title: string;
  content: string;
  category: KnowledgeCategory;
  tags: string[];
  pinned: boolean;
  visibility: KnowledgeVisibility;
  createdBy: KnowledgeAuthor | null;
  updatedBy: KnowledgeAuthor | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeEntriesPayload {
  canManage: boolean;
  /** Visibility levels the user may give an entry; empty for someone who cannot write. */
  assignableVisibilities: KnowledgeVisibility[];
  /** Every tag on an entry the user can see, for the tag filter. */
  tags: string[];
  items: KnowledgeEntryItem[];
}

export interface ImportantDateItem {
  id: string;
  title: string;
  notes: string | null;
  ruleKind: ImportantDateRuleKind;
  month: number;
  day: number | null;
  weekday: number | null;
  nth: number | null;
  reminderLeadDays: number | null;
  visibility: KnowledgeVisibility;
  /** The next day the date falls on, today included, as YYYY-MM-DD. */
  nextDate: string | null;
  createdBy: KnowledgeAuthor | null;
  updatedBy: KnowledgeAuthor | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportantDatesPayload {
  canManage: boolean;
  assignableVisibilities: KnowledgeVisibility[];
  items: ImportantDateItem[];
}
