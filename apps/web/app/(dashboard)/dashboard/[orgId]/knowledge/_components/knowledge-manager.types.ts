import type { ImportantDatesPayload, KnowledgeEntriesPayload } from '@churchflow/shared';

/** The page loads only the view it shows, so the manager holds one of the two payloads. */
export type KnowledgeViewData =
  | { view: 'notes'; payload: KnowledgeEntriesPayload }
  | { view: 'dates'; payload: ImportantDatesPayload };

export type KnowledgeMutationResult = { ok: true } | { ok: false; error: string };
