'use client';

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useState } from 'react';

export interface DataTableColumnMeta {
  headerClassName?: string;
  cellClassName?: string;
}

export function DataTable<TData>({
  data,
  columns,
  getRowHref,
  emptyMessage = 'No results found.',
  frameClassName,
  tableClassName,
  getRowClassName,
}: {
  data: TData[];
  columns: Array<ColumnDef<TData>>;
  getRowHref?: (row: TData) => string;
  emptyMessage?: string;
  frameClassName?: string;
  tableClassName?: string;
  getRowClassName?: (row: TData) => string | undefined;
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
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
  );
}

function isInteractiveTableTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    ? Boolean(target.closest('a, button, input, select, textarea, summary, details'))
    : false;
}
