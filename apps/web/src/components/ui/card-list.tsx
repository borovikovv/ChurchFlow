'use client';

import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './button';
import type { DataTablePagination } from './data-table';

type CardListPagination = Pick<
  DataTablePagination,
  | 'nextPageLabel'
  | 'ofLabel'
  | 'page'
  | 'pageSize'
  | 'preserveParams'
  | 'previousPageLabel'
  | 'total'
>;

export interface CardListLoadMore {
  autoLoad?: boolean;
  hasMore: boolean;
  isLoading: boolean;
  label: string;
  loadingLabel: string;
  onLoadMore: () => void;
}

export function CardList<TData>({
  data,
  emptyMessage,
  getCardClassName,
  getCardKey,
  loadMore,
  pagination,
  renderCard,
}: {
  data: TData[];
  emptyMessage: string;
  getCardClassName?: (row: TData) => string | undefined;
  getCardKey: (row: TData) => string;
  loadMore?: CardListLoadMore | undefined;
  pagination?: CardListPagination | undefined;
  renderCard: (row: TData) => ReactNode;
}) {
  if (data.length === 0) {
    return <div className="table-empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="grid min-w-0 gap-3">
      <ul className="grid min-w-0 gap-2">
        {data.map((row) => {
          const cardClassName = getCardClassName?.(row);

          return (
            <li
              className={[
                'relative flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm focus-within:border-[var(--accent-mobile)] focus-within:ring-2 focus-within:ring-[rgba(22,163,74,0.15)]',
                cardClassName ?? '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={getCardKey(row)}
            >
              {renderCard(row)}
            </li>
          );
        })}
      </ul>
      {loadMore ? (
        <CardListLoadMoreControl {...loadMore} />
      ) : pagination ? (
        <CardListPaginationControls {...pagination} />
      ) : null}
    </div>
  );
}

function CardListLoadMoreControl({
  autoLoad,
  hasMore,
  isLoading,
  label,
  loadingLabel,
  onLoadMore,
}: CardListLoadMore) {
  const sentinelRef = useLoadOnVisible({
    enabled: Boolean(autoLoad) && hasMore && !isLoading,
    onVisible: onLoadMore,
  });

  if (!hasMore) return null;

  return (
    <div className="grid min-w-0" ref={sentinelRef}>
      <Button
        className="min-h-11 w-full"
        disabled={isLoading}
        type="button"
        variant="secondary"
        onClick={onLoadMore}
      >
        {isLoading ? loadingLabel : label}
      </Button>
    </div>
  );
}

function useLoadOnVisible({ enabled, onVisible }: { enabled: boolean; onVisible: () => void }) {
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  // The caller rebuilds onVisible on every render, so the observer reads it through a ref
  // instead of resubscribing each time.
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    if (!enabled || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onVisibleRef.current();
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [enabled, sentinel]);

  return setSentinel;
}

function CardListPaginationControls({
  nextPageLabel,
  ofLabel,
  page,
  pageSize,
  preserveParams,
  previousPageLabel,
  total,
}: CardListPagination) {
  const pathname = usePathname();
  const router = useRouter();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const firstItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(total, currentPage * pageSize);

  const pushPage = (nextPage: number) => {
    const params = new URLSearchParams();
    Object.entries(preserveParams ?? {}).forEach(([paramName, paramValue]) => {
      if (paramValue) params.set(paramName, paramValue);
    });
    if (nextPage > 1) params.set('page', String(nextPage));
    params.set('pageSize', String(pageSize));

    const query = params.toString();
    router.push((query ? `${pathname}?${query}` : pathname) as Route);
  };

  return (
    <nav
      aria-label={ofLabel}
      className="flex items-center justify-between gap-3 text-sm text-[var(--foreground)]"
    >
      <span className="min-w-0 truncate">
        {firstItem}-{lastItem} {ofLabel} {total}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <button
          className="data-table-pagination-button"
          disabled={currentPage <= 1}
          onClick={() => pushPage(currentPage - 1)}
          type="button"
        >
          <span className="sr-only">{previousPageLabel}</span>
          <span aria-hidden="true">‹</span>
        </button>
        <span aria-hidden="true" className="px-1 font-medium">
          {currentPage}/{pageCount}
        </span>
        <button
          className="data-table-pagination-button"
          disabled={currentPage >= pageCount}
          onClick={() => pushPage(currentPage + 1)}
          type="button"
        >
          <span className="sr-only">{nextPageLabel}</span>
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </nav>
  );
}
