'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { KnowledgeEntryItem } from '@churchflow/shared';
import { DataTable } from '@/components/ui/data-table';
import { RichTextContent } from '@/components/ui/rich-text-content';
import { KnowledgeAuthorMeta } from './knowledge-meta';
import { KnowledgeNoteActions } from './knowledge-note-actions';
import { KnowledgeNoteSummary } from './knowledge-note-summary';
import type { KnowledgeNotesListProps } from './knowledge-lists.types';
import { nowrapColumnMeta } from './knowledge-lists.styles';

export function KnowledgeNotesTable({
  disabled,
  filtered,
  payload,
  onDelete,
  onUpdate,
}: KnowledgeNotesListProps) {
  const t = useTranslations('knowledge');
  const { assignableVisibilities, canManage } = payload;
  const columns = useMemo<Array<ColumnDef<KnowledgeEntryItem>>>(() => {
    const infoColumns: Array<ColumnDef<KnowledgeEntryItem>> = [
      {
        id: 'note',
        header: t('noteColumn'),
        accessorFn: (entry) => entry.title,
        cell: ({ row }) => (
          <button
            aria-expanded={row.getIsExpanded()}
            className="flex w-full min-w-0 cursor-pointer items-start gap-2 border-0 bg-transparent p-0 text-left text-[var(--foreground)]"
            type="button"
            onClick={row.getToggleExpandedHandler()}
          >
            <KnowledgeNoteSummary entry={row.original} />
          </button>
        ),
        meta: { headerClassName: 'w-[46%]', cellClassName: 'w-[46%]' },
      },
      {
        id: 'visibility',
        header: t('visibilityColumn'),
        accessorFn: (entry) => entry.visibility,
        cell: ({ row }) => t(`visibilities.${row.original.visibility}`),
        meta: nowrapColumnMeta,
      },
      {
        id: 'updated',
        header: t('updatedColumn'),
        accessorFn: (entry) => entry.updatedAt,
        cell: ({ row }) => (
          <KnowledgeAuthorMeta
            createdAt={row.original.createdAt}
            createdBy={row.original.createdBy}
            updatedAt={row.original.updatedAt}
            updatedBy={row.original.updatedBy}
          />
        ),
      },
    ];
    if (!canManage) return infoColumns;

    return [
      ...infoColumns,
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <KnowledgeNoteActions
            assignableVisibilities={assignableVisibilities}
            disabled={disabled}
            entry={row.original}
            onDelete={onDelete}
            onUpdate={onUpdate}
          />
        ),
        meta: { headerClassName: 'w-11', cellClassName: 'w-11' },
      },
    ];
  }, [assignableVisibilities, canManage, disabled, onDelete, onUpdate, t]);

  return (
    <DataTable
      columns={columns}
      data={payload.items}
      emptyMessage={filtered ? t('emptyNotesFiltered') : t('emptyNotes')}
      getRowCanExpand={() => true}
      renderExpandedRow={(row) => (
        <div className="max-w-[860px] py-1.5">
          <RichTextContent html={row.original.content} />
        </div>
      )}
      tableClassName="min-w-[760px]"
    />
  );
}
