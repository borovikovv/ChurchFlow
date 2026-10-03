import {
  createImportantDateSchema,
  createKnowledgeEntrySchema,
  listImportantDatesQuerySchema,
  listKnowledgeEntriesQuerySchema,
  updateImportantDateSchema,
  updateKnowledgeEntrySchema,
} from '@churchflow/shared';
import type {
  CreateImportantDateInput,
  CreateKnowledgeEntryInput,
  ImportantDateRuleKind,
  KnowledgeCategory,
  KnowledgeVisibility,
  ListImportantDatesQuery,
  ListKnowledgeEntriesQuery,
  UpdateImportantDateInput,
  UpdateKnowledgeEntryInput,
} from '@churchflow/shared';

export class ListKnowledgeEntriesQueryDto implements ListKnowledgeEntriesQuery {
  static readonly schema = listKnowledgeEntriesQuerySchema;

  q?: string;
  category?: KnowledgeCategory;
  tag?: string;
  pinned?: boolean;
}

export class CreateKnowledgeEntryDto implements CreateKnowledgeEntryInput {
  static readonly schema = createKnowledgeEntrySchema;

  title!: string;
  content!: string;
  category!: KnowledgeCategory;
  tags!: string[];
  pinned!: boolean;
  visibility!: KnowledgeVisibility;
}

export class UpdateKnowledgeEntryDto implements UpdateKnowledgeEntryInput {
  static readonly schema = updateKnowledgeEntrySchema;

  title?: string;
  content?: string;
  category?: KnowledgeCategory;
  tags?: string[];
  pinned?: boolean;
  visibility?: KnowledgeVisibility;
}

export class ListImportantDatesQueryDto implements ListImportantDatesQuery {
  static readonly schema = listImportantDatesQuerySchema;

  q?: string;
}

export class CreateImportantDateDto implements CreateImportantDateInput {
  static readonly schema = createImportantDateSchema;

  title!: string;
  notes!: string | null;
  ruleKind!: ImportantDateRuleKind;
  month!: number;
  day!: number | null;
  weekday!: number | null;
  nth!: CreateImportantDateInput['nth'];
  reminderLeadDays!: number | null;
  visibility!: KnowledgeVisibility;
}

export class UpdateImportantDateDto implements UpdateImportantDateInput {
  static readonly schema = updateImportantDateSchema;

  title?: string;
  notes?: string | null;
  ruleKind?: ImportantDateRuleKind;
  month?: number;
  day?: number | null;
  weekday?: number | null;
  nth?: UpdateImportantDateInput['nth'];
  reminderLeadDays?: number | null;
  visibility?: KnowledgeVisibility;
}
