'use client';

import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
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

export function CardList<TData>({
  data,
  emptyMessage,
  getCardClassName,
  getCardKey,
  pagination,
  renderCard,
}: {
  data: TData[];
  emptyMessage: string;
  getCardClassName?: (row: TData) => string | undefined;
  getCardKey: (row: TData) => string;
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
                'relative flex min-w-0 flex-col gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[rgba(9,105,218,0.15)]',
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
      {pagination ? <CardListPaginationControls {...pagination} /> : null}
    </div>
  );
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
