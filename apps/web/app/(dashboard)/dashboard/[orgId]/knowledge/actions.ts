'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/api/client';
import type {
  CreateImportantDateInput,
  CreateKnowledgeEntryInput,
  ImportantDateItem,
  ImportantDatesPayload,
  KnowledgeEntriesPayload,
  KnowledgeEntryItem,
  UpdateImportantDateInput,
  UpdateKnowledgeEntryInput,
} from '@churchflow/shared';
import { organizationKnowledgeRoute } from '@/features/organizations/routes';
import {
  importantDatesRequestQuery,
  knowledgeEntriesRequestQuery,
  type KnowledgePageQuery,
} from './knowledge-page-query';

const JSON_HEADERS = { 'content-type': 'application/json' };

function revalidateKnowledge(organizationId: string) {
  revalidatePath(organizationKnowledgeRoute(organizationId));
}

export async function loadKnowledgeEntriesAction(input: {
  organizationId: string;
  query: KnowledgePageQuery;
}) {
  const result = await apiFetch<KnowledgeEntriesPayload>(
    `/organizations/${input.organizationId}/knowledge?${knowledgeEntriesRequestQuery(input.query)}`,
  );

  return result.ok
    ? { ok: true as const, payload: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function loadImportantDatesAction(input: {
  organizationId: string;
  query: KnowledgePageQuery;
}) {
  const result = await apiFetch<ImportantDatesPayload>(
    `/organizations/${input.organizationId}/important-dates?${importantDatesRequestQuery(input.query)}`,
  );

  return result.ok
    ? { ok: true as const, payload: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function createKnowledgeEntryAction(input: {
  organizationId: string;
  entry: CreateKnowledgeEntryInput;
}) {
  const result = await apiFetch<KnowledgeEntryItem>(
    `/organizations/${input.organizationId}/knowledge`,
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input.entry) },
  );
  revalidateKnowledge(input.organizationId);

  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error.message };
}

export async function updateKnowledgeEntryAction(input: {
  organizationId: string;
  entryId: string;
  entry: UpdateKnowledgeEntryInput;
}) {
  const result = await apiFetch<KnowledgeEntryItem>(
    `/organizations/${input.organizationId}/knowledge/${input.entryId}`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(input.entry) },
  );
  revalidateKnowledge(input.organizationId);

  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error.message };
}

export async function deleteKnowledgeEntryAction(input: {
  organizationId: string;
  entryId: string;
}) {
  const result = await apiFetch<{ id: string }>(
    `/organizations/${input.organizationId}/knowledge/${input.entryId}`,
    { method: 'DELETE' },
  );
  revalidateKnowledge(input.organizationId);

  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error.message };
}

export async function createImportantDateAction(input: {
  organizationId: string;
  date: CreateImportantDateInput;
}) {
  const result = await apiFetch<ImportantDateItem>(
    `/organizations/${input.organizationId}/important-dates`,
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input.date) },
  );
  revalidateKnowledge(input.organizationId);

  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error.message };
}

export async function updateImportantDateAction(input: {
  organizationId: string;
  dateId: string;
  date: UpdateImportantDateInput;
}) {
  const result = await apiFetch<ImportantDateItem>(
    `/organizations/${input.organizationId}/important-dates/${input.dateId}`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(input.date) },
  );
  revalidateKnowledge(input.organizationId);

  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error.message };
}

export async function deleteImportantDateAction(input: { organizationId: string; dateId: string }) {
  const result = await apiFetch<{ id: string }>(
    `/organizations/${input.organizationId}/important-dates/${input.dateId}`,
    { method: 'DELETE' },
  );
  revalidateKnowledge(input.organizationId);

  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error.message };
}
