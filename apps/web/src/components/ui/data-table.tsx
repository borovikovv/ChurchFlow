'use client';

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { usePathname, useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useState } from 'react';
import { FormSelect } from '@/components/forms/form-select';

export interface DataTableColumnMeta {
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTablePagination {
  firstPageLabel: string;
  itemLabel: string;
  lastPageLabel: string;
  nextPageLabel: string;
  ofLabel: string;
  page: number;
  pageSize: number;
  pageSizeLabel: string;
  pageSizeOptions: number[];
  previousPageLabel: string;
  preserveParams?: Record<string, string | undefined>;
  total: number;
}

export function DataTable<TData>({
  data,
  columns,
  getRowHref,
  emptyMessage = 'No results found.',
  frameClassName,
  tableClassName,
  getRowClassName,
  pagination,
}: {
  data: TData[];
  columns: Array<ColumnDef<TData>>;
  getRowHref?: (row: TData) => string;
  emptyMessage?: string;
  frameClassName?: string;
  tableClassName?: string;
  getRowClassName?: (row: TData) => string | undefined;
  pagination?: DataTablePagination | undefined;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const pageCount = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (data.length === 0) {
    return <div className="table-empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="grid gap-3">
      <div className={frameClassName ? `data-table-frame ${frameClassName}` : 'data-table-frame'}>
        <table className={tableClassName ? `data-table ${tableClassName}` : 'data-table'}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined;

                  return (
                    <th className={meta?.headerClassName} key={header.id} scope="col">
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          className="table-sort-button"
                          onClick={header.column.getToggleSortingHandler()}
                          type="button"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span aria-hidden="true">
                            {header.column.getIsSorted() === 'asc'
                              ? ' ↑'
                              : header.column.getIsSorted() === 'desc'
                                ? ' ↓'
                                : ''}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const href = getRowHref?.(row.original);
              const rowClassName = getRowClassName?.(row.original);
              return (
                <tr
                  className={
                    href && rowClassName
                      ? `clickable-table-row ${rowClassName}`
                      : href
                        ? 'clickable-table-row'
                        : rowClassName
                  }
                  key={row.id}
                  onClick={
                    href
                      ? (event) => {
                          if (isInteractiveTableTarget(event.target)) return;
                          router.push(href as Route);
                        }
                      : undefined
                  }
                  onKeyDown={
                    href
                      ? (event) => {
                          if (isInteractiveTableTarget(event.target)) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            router.push(href as Route);
                          }
                        }
                      : undefined
                  }
                  role={href ? 'link' : undefined}
                  tabIndex={href ? 0 : undefined}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as DataTableColumnMeta | undefined;

                    return (
                      <td className={meta?.cellClassName} key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pagination ? (
        <DataTablePaginationControls
          itemLabel={pagination.itemLabel}
          firstPageLabel={pagination.firstPageLabel}
          lastPageLabel={pagination.lastPageLabel}
          nextPageLabel={pagination.nextPageLabel}
          ofLabel={pagination.ofLabel}
          page={Math.min(pagination.page, pageCount)}
          pageCount={pageCount}
          pageSize={pagination.pageSize}
          pageSizeLabel={pagination.pageSizeLabel}
          pageSizeOptions={pagination.pageSizeOptions}
          previousPageLabel={pagination.previousPageLabel}
          pathname={pathname}
          routerPush={(href) => router.push(href as Route)}
          total={pagination.total}
          {...(pagination.preserveParams ? { preserveParams: pagination.preserveParams } : {})}
        />
      ) : null}
    </div>
  );
}

function DataTablePaginationControls({
  itemLabel,
  firstPageLabel,
  lastPageLabel,
  nextPageLabel,
  ofLabel,
  page,
  pageCount,
  pageSize,
  pageSizeLabel,
  pageSizeOptions,
  previousPageLabel,
  pathname,
  preserveParams,
  routerPush,
  total,
}: DataTablePagination & {
  pageCount: number;
  pathname: string;
  routerPush: (href: string) => void;
}) {
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(total, page * pageSize);
  const pages = createPaginationItems(page, pageCount);

  const pushPage = (nextPage: number, nextPageSize = pageSize) => {
    const params = new URLSearchParams();
    Object.entries(preserveParams ?? {}).forEach(([paramName, paramValue]) => {
      if (paramValue) params.set(paramName, paramValue);
    });
    if (nextPage > 1) params.set('page', String(nextPage));
    params.set('pageSize', String(nextPageSize));

    const query = params.toString();
    routerPush(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <nav className="data-table-pagination" aria-label="Table pagination">
      <div className="data-table-pagination-summary">
        <span>
          {firstItem}-{lastItem} {ofLabel} {total}
        </span>
        <span aria-hidden="true">|</span>
        <FormSelect
          className="data-table-page-size-field"
          label={pageSizeLabel}
          labelClassName="data-table-page-size-label"
          selectClassName="data-table-page-size-select"
          size="medium"
          value={pageSize}
          onChange={(event) => pushPage(1, Number(event.currentTarget.value))}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </FormSelect>
      </div>
      <div className="data-table-pagination-pages">
        <PaginationButton label={firstPageLabel} disabled={page <= 1} onClick={() => pushPage(1)}>
          {'<<'}
        </PaginationButton>
        <PaginationButton
          label={previousPageLabel}
          disabled={page <= 1}
          onClick={() => pushPage(page - 1)}
        >
          {'<'}
        </PaginationButton>
        {pages.map((item) =>
          item === 'ellipsis' ? (
            <span className="data-table-pagination-ellipsis" key={`${item}-${page}`}>
              ...
            </span>
          ) : (
            <PaginationButton
              key={item}
              label={`${itemLabel} ${item}`}
              active={item === page}
              onClick={() => pushPage(item)}
            >
              {item}
            </PaginationButton>
          ),
        )}
        <PaginationButton
          label={nextPageLabel}
          disabled={page >= pageCount}
          onClick={() => pushPage(page + 1)}
        >
          {'>'}
        </PaginationButton>
        <PaginationButton
          label={lastPageLabel}
          disabled={page >= pageCount}
          onClick={() => pushPage(pageCount)}
        >
          {'>>'}
        </PaginationButton>
      </div>
    </nav>
  );
}

function PaginationButton({
  active,
  children,
  disabled,
  label,
  onClick,
}: {
  active?: boolean;
  children: string | number;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? 'data-table-pagination-button active' : 'data-table-pagination-button'}
      type="button"
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function createPaginationItems(page: number, pageCount: number): Array<number | 'ellipsis'> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const items: Array<number | 'ellipsis'> = [];
  let previous = 0;

  Array.from(pages)
    .filter((item) => item >= 1 && item <= pageCount)
    .sort((left, right) => left - right)
    .forEach((item) => {
      if (previous && item - previous > 1) items.push('ellipsis');
      items.push(item);
      previous = item;
    });

  return items;
}

function isInteractiveTableTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    ? Boolean(target.closest('a, button, input, select, textarea, summary, details'))
    : false;
}
