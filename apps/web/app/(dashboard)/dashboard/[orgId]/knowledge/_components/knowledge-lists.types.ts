import type {
  ImportantDateItem,
  ImportantDatesPayload,
  KnowledgeEntriesPayload,
  KnowledgeEntryItem,
  UpdateImportantDateInput,
  UpdateKnowledgeEntryInput,
} from '@churchflow/shared';

export interface KnowledgeNotesListProps {
  disabled: boolean;
  /** Whether a search or filter narrowed the list, which changes what its empty state says. */
  filtered: boolean;
  payload: KnowledgeEntriesPayload;
  onUpdate: (entryId: string, entry: UpdateKnowledgeEntryInput) => void;
  onDelete: (entry: KnowledgeEntryItem) => Promise<void>;
}

export interface ImportantDatesListProps {
  filtered: boolean;
  payload: ImportantDatesPayload;
  onUpdate: (dateId: string, date: UpdateImportantDateInput) => void;
  onDelete: (date: ImportantDateItem) => Promise<void>;
}
