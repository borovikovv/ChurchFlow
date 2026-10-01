import {
  listImportantDatesQuerySchema,
  listKnowledgeEntriesQuerySchema,
  type KnowledgeCategory,
} from '@churchflow/shared';

export type KnowledgeView = 'notes' | 'dates';

export type KnowledgePinnedFilter = 'true' | 'false' | '';

/** The page's own URL state; `search` is sent to the API as `q`. */
export interface KnowledgePageQuery {
  view: KnowledgeView;
  search: string;
  category: KnowledgeCategory | '';
  tag: string;
  pinned: KnowledgePinnedFilter;
}

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

/** Each parameter is validated on its own, so one bad value drops only itself. */
export function parseKnowledgePageQuery(params: SearchParams): KnowledgePageQuery {
  const view = firstValue(params['view']);
  const filters = listKnowledgeEntriesQuerySchema.shape;
  const search = filters.q.safeParse(firstValue(params['search']));
  const category = filters.category.safeParse(firstValue(params['category']) || undefined);
  const tag = filters.tag.safeParse(firstValue(params['tag']));
  const pinned = firstValue(params['pinned']);

  return {
    view: view === 'dates' ? 'dates' : 'notes',
    search: search.success ? (search.data ?? '') : '',
    category: category.success ? (category.data ?? '') : '',
    tag: tag.success ? (tag.data ?? '') : '',
    pinned: pinned === 'true' || pinned === 'false' ? pinned : '',
  };
}

/** The validated query string for GET /knowledge, with only the filters that are set. */
export function knowledgeEntriesRequestQuery(query: KnowledgePageQuery): URLSearchParams {
  const params = new URLSearchParams();
  const parsed = listKnowledgeEntriesQuerySchema.safeParse({
    ...(query.search ? { q: query.search } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.tag ? { tag: query.tag } : {}),
    ...(query.pinned ? { pinned: query.pinned } : {}),
  });
  if (!parsed.success) return params;

  if (parsed.data.q) params.set('q', parsed.data.q);
  if (parsed.data.category) params.set('category', parsed.data.category);
  if (parsed.data.tag) params.set('tag', parsed.data.tag);
  if (parsed.data.pinned !== undefined) params.set('pinned', String(parsed.data.pinned));

  return params;
}

export function importantDatesRequestQuery(query: KnowledgePageQuery): URLSearchParams {
  const params = new URLSearchParams();
  const parsed = listImportantDatesQuerySchema.safeParse({
    ...(query.search ? { q: query.search } : {}),
  });
  if (parsed.success && parsed.data.q) params.set('q', parsed.data.q);

  return params;
}

/** The filters a control keeps when it changes its own one. */
export function knowledgePreservedParams(
  query: KnowledgePageQuery,
): Record<string, string | undefined> {
  return {
    view: query.view === 'dates' ? 'dates' : undefined,
    search: query.search || undefined,
    category: query.category || undefined,
    tag: query.tag || undefined,
    pinned: query.pinned || undefined,
  };
}
