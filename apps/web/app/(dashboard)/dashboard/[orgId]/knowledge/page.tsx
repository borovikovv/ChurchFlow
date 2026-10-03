import { apiFetch } from '@/api/client';
import type { ImportantDatesPayload, KnowledgeEntriesPayload } from '@churchflow/shared';
import { KnowledgeManager } from './_components/knowledge-manager';
import type { KnowledgeViewData } from './_components/knowledge-manager.types';
import {
  importantDatesRequestQuery,
  knowledgeEntriesRequestQuery,
  parseKnowledgePageQuery,
  type KnowledgePageQuery,
} from './knowledge-page-query';

const EMPTY_ACCESS = { canManage: false, assignableVisibilities: [] };

async function loadView(
  organizationId: string,
  query: KnowledgePageQuery,
): Promise<{ data: KnowledgeViewData; error: string | null }> {
  if (query.view === 'dates') {
    const result = await apiFetch<ImportantDatesPayload>(
      `/organizations/${organizationId}/important-dates?${importantDatesRequestQuery(query)}`,
    );
    return result.ok
      ? { data: { view: 'dates', payload: result.data }, error: null }
      : {
          data: { view: 'dates', payload: { ...EMPTY_ACCESS, items: [] } },
          error: result.error.message,
        };
  }

  const result = await apiFetch<KnowledgeEntriesPayload>(
    `/organizations/${organizationId}/knowledge?${knowledgeEntriesRequestQuery(query)}`,
  );
  return result.ok
    ? { data: { view: 'notes', payload: result.data }, error: null }
    : {
        data: { view: 'notes', payload: { ...EMPTY_ACCESS, tags: [], items: [] } },
        error: result.error.message,
      };
}

export default async function KnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const query = parseKnowledgePageQuery(await searchParams);
  const { data, error } = await loadView(orgId, query);

  return (
    <div className="stack">
      {error ? <p className="form-error">{error}</p> : null}
      <KnowledgeManager
        key={JSON.stringify(query)}
        initialData={data}
        organizationId={orgId}
        query={query}
      />
    </div>
  );
}
