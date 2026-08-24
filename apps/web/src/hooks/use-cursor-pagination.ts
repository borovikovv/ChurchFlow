'use client';

import { useMemo, useState } from 'react';

export type CursorPageResult<TItem> =
  | { ok: true; cursor: string | null; items: TItem[] }
  | { ok: false; error: string };

interface LoadedPage<TItem> {
  cursor: string | null;
  items: TItem[];
}

export function useCursorPagination<TItem>({
  getItemKey,
  initialCursor,
  initialItems,
  loadPage,
}: {
  getItemKey: (item: TItem) => string;
  initialCursor: string | null;
  initialItems: TItem[];
  loadPage: (cursor: string) => Promise<CursorPageResult<TItem>>;
}) {
  const [loadedPages, setLoadedPages] = useState<Array<LoadedPage<TItem>>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLoadedPage = loadedPages.at(-1);
  const nextCursor = lastLoadedPage ? lastLoadedPage.cursor : initialCursor;
  const items = useMemo(() => {
    const seen = new Set<string>();

    return [initialItems, ...loadedPages.map((loadedPage) => loadedPage.items)]
      .flat()
      .filter((item) => {
        const key = getItemKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [getItemKey, initialItems, loadedPages]);

  const loadMore = () => {
    if (!nextCursor || isLoading) return;

    setIsLoading(true);
    setError(null);
    void loadPage(nextCursor).then((result) => {
      setIsLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLoadedPages((current) => [...current, { cursor: result.cursor, items: result.items }]);
    });
  };

  return { error, hasMore: Boolean(nextCursor), isLoading, items, loadMore };
}
