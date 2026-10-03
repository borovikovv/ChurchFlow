import type {
  ImportantDateItem,
  ImportantDatesPayload,
  KnowledgeEntriesPayload,
  KnowledgeEntryItem,
  UpdateImportantDateInput,
  UpdateKnowledgeEntryInput,
} from '@churchflow/shared';
import type { KnowledgePageQuery } from '../knowledge-page-query';

export interface KnowledgeNotesListProps {
  disabled: boolean;
  /** Whether a search or filter narrowed the list, which changes what its empty state says. */
  filtered: boolean;
  payload: KnowledgeEntriesPayload;
  /** `onSuccess` runs only once the server accepted the change, so a dialog can stay open on error. */
  onUpdate: (entryId: string, entry: UpdateKnowledgeEntryInput, onSuccess?: () => void) => void;
  onDelete: (entry: KnowledgeEntryItem) => Promise<void>;
}

export interface KnowledgeNotesBrowserProps extends KnowledgeNotesListProps {
  query: KnowledgePageQuery;
}

export interface ImportantDatesListProps {
  filtered: boolean;
  payload: ImportantDatesPayload;
  onUpdate: (dateId: string, date: UpdateImportantDateInput, onSuccess?: () => void) => void;
  onDelete: (date: ImportantDateItem) => Promise<void>;
}

export interface ImportantDatesBrowserProps extends ImportantDatesListProps {
  query: KnowledgePageQuery;
}
