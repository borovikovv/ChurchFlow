import type { DataTablePagination } from './data-table';

export type DataTablePaginationLabels = Pick<
  DataTablePagination,
  | 'firstPageLabel'
  | 'itemLabel'
  | 'lastPageLabel'
  | 'nextPageLabel'
  | 'ofLabel'
  | 'pageSizeLabel'
  | 'previousPageLabel'
>;

export function createDataTablePagination({
  labels,
  page,
  pageSize,
  pageSizeOptions,
  preserveParams,
  total,
}: {
  labels: DataTablePaginationLabels;
  page: number;
  pageSize: number;
  pageSizeOptions: number[];
  preserveParams?: DataTablePagination['preserveParams'] | undefined;
  total: number;
}): DataTablePagination {
  return {
    ...labels,
    page,
    pageSize,
    pageSizeOptions,
    total,
    ...(preserveParams ? { preserveParams } : {}),
  };
}
