'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { ImportantDateItem } from '@churchflow/shared';
import { DataTable } from '@/components/ui/data-table';
import { ImportantDateActions } from './important-date-actions';
import {
  ImportantDateNextDate,
  ImportantDateReminder,
  ImportantDateRuleLabel,
} from './knowledge-meta';
import type { ImportantDatesListProps } from './knowledge-lists.types';

export function ImportantDatesTable({
  filtered,
  payload,
  onDelete,
  onUpdate,
}: ImportantDatesListProps) {
  const t = useTranslations('knowledge');
  const { assignableVisibilities, canManage } = payload;
  const columns = useMemo<Array<ColumnDef<ImportantDateItem>>>(() => {
    const infoColumns: Array<ColumnDef<ImportantDateItem>> = [
      {
        id: 'date',
        header: t('dateColumn'),
        accessorFn: (date) => date.title,
        cell: ({ row }) => (
          <span className="grid min-w-0 gap-1">
            <span className="font-bold [overflow-wrap:anywhere]">{row.original.title}</span>
            {row.original.notes ? (
              <span className="whitespace-pre-wrap text-xs text-[var(--muted)] [overflow-wrap:anywhere]">
                {row.original.notes}
              </span>
            ) : null}
          </span>
        ),
        meta: { headerClassName: 'w-[34%]', cellClassName: 'w-[34%]' },
      },
      {
        id: 'rule',
        header: t('ruleColumn'),
        cell: ({ row }) => <ImportantDateRuleLabel date={row.original} />,
      },
      {
        id: 'nextDate',
        header: t('nextDateColumn'),
        accessorFn: (date) => date.nextDate,
        cell: ({ row }) => <ImportantDateNextDate nextDate={row.original.nextDate} />,
        meta: { headerClassName: 'whitespace-nowrap', cellClassName: 'whitespace-nowrap' },
      },
      {
        id: 'reminder',
        header: t('reminderColumn'),
        cell: ({ row }) => <ImportantDateReminder days={row.original.reminderLeadDays} />,
        meta: { headerClassName: 'whitespace-nowrap', cellClassName: 'whitespace-nowrap' },
      },
      {
        id: 'visibility',
        header: t('visibilityColumn'),
        cell: ({ row }) => t(`visibilities.${row.original.visibility}`),
        meta: { headerClassName: 'whitespace-nowrap', cellClassName: 'whitespace-nowrap' },
      },
    ];
    if (!canManage) return infoColumns;

    return [
      ...infoColumns,
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <ImportantDateActions
            assignableVisibilities={assignableVisibilities}
            date={row.original}
            onDelete={onDelete}
            onUpdate={onUpdate}
          />
        ),
        meta: { headerClassName: 'w-11', cellClassName: 'w-11' },
      },
    ];
  }, [assignableVisibilities, canManage, onDelete, onUpdate, t]);

  return (
    <DataTable
      columns={columns}
      data={payload.items}
      emptyMessage={filtered ? t('emptyDatesFiltered') : t('emptyDates')}
      tableClassName="min-w-[860px]"
    />
  );
}
