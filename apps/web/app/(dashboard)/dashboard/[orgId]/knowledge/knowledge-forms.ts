import { z } from 'zod';
import {
  createKnowledgeEntrySchema,
  type CreateImportantDateFormInput,
  type ImportantDateItem,
  type KnowledgeEntryItem,
  type KnowledgeVisibility,
} from '@churchflow/shared';

/** Tags are typed as one comma-separated line; the shared schema then trims and de-duplicates. */
export function parseTagsText(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function formatTagsText(tags: readonly string[]): string {
  return tags.join(', ');
}

export const knowledgeNoteFormSchema = createKnowledgeEntrySchema.extend({
  tags: z.string().transform(parseTagsText).pipe(createKnowledgeEntrySchema.shape.tags),
});

export type KnowledgeNoteFormValues = z.input<typeof knowledgeNoteFormSchema>;

export function knowledgeNoteFormValues(
  entry: KnowledgeEntryItem | undefined,
  assignableVisibilities: readonly KnowledgeVisibility[],
): KnowledgeNoteFormValues {
  return {
    title: entry?.title ?? '',
    content: entry?.content ?? '',
    category: entry?.category ?? 'OTHER',
    tags: formatTagsText(entry?.tags ?? []),
    pinned: entry?.pinned ?? false,
    visibility: entry?.visibility ?? assignableVisibilities[0],
  };
}

export function importantDateFormValues(
  date: ImportantDateItem | undefined,
  assignableVisibilities: readonly KnowledgeVisibility[],
): CreateImportantDateFormInput {
  if (!date) {
    return {
      title: '',
      notes: null,
      ruleKind: 'FIXED',
      month: 1,
      day: 1,
      weekday: null,
      nth: null,
      reminderLeadDays: null,
      visibility: assignableVisibilities[0],
    };
  }

  return {
    title: date.title,
    notes: date.notes,
    ruleKind: date.ruleKind,
    month: date.month,
    day: date.day,
    weekday: date.weekday,
    nth: date.nth,
    reminderLeadDays: date.reminderLeadDays,
    visibility: date.visibility,
  };
}

/** Switching the rule kind fills the fields the new kind needs and clears the others. */
export function ruleFieldsFor(
  ruleKind: CreateImportantDateFormInput['ruleKind'],
): Pick<CreateImportantDateFormInput, 'day' | 'weekday' | 'nth'> {
  return ruleKind === 'FIXED'
    ? { day: 1, weekday: null, nth: null }
    : { day: null, weekday: 0, nth: 1 };
}

/** An empty select or number field means "not set"; anything else is a whole number. */
export function optionalNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}
