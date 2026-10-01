'use client';

import { useTranslations } from 'next-intl';
import type { KnowledgeEntryItem, KnowledgeVisibility } from '@churchflow/shared';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';
import {
  TableRowAction,
  TableRowActions,
  tableRowActionClassNameFor,
  useTableRowActions,
} from '@/components/ui/table-row-actions';
import type { KnowledgeNotesListProps } from './knowledge-lists.types';
import { KnowledgeNoteFormDialog } from './knowledge-note-form-dialog';

export function KnowledgeNoteActions({
  assignableVisibilities,
  disabled,
  entry,
  onDelete,
  onUpdate,
}: Pick<KnowledgeNotesListProps, 'disabled' | 'onDelete' | 'onUpdate'> & {
  assignableVisibilities: KnowledgeVisibility[];
  entry: KnowledgeEntryItem;
}) {
  const t = useTranslations('knowledge');

  return (
    <TableRowActions label={t('noteActions')}>
      <EditNoteAction
        assignableVisibilities={assignableVisibilities}
        entry={entry}
        onUpdate={onUpdate}
      />
      <TableRowAction
        disabled={disabled}
        onSelect={() => onUpdate(entry.id, { pinned: !entry.pinned })}
      >
        {entry.pinned ? t('unpin') : t('pin')}
      </TableRowAction>
      <form
        className="contents"
        action={async () => {
          await onDelete(entry);
        }}
      >
        <ConfirmSubmitButton
          cancelLabel={t('cancel')}
          confirmLabel={t('delete')}
          confirmVariant="danger"
          description={t('deleteNoteDescription', { title: entry.title })}
          pendingLabel={t('deleting')}
          title={t('deleteNoteTitle')}
          triggerClassName={tableRowActionClassNameFor({ destructive: true })}
          triggerLabel={t('delete')}
          variant="ghost"
        />
      </form>
    </TableRowActions>
  );
}

function EditNoteAction({
  assignableVisibilities,
  entry,
  onUpdate,
}: Pick<KnowledgeNotesListProps, 'onUpdate'> & {
  assignableVisibilities: KnowledgeVisibility[];
  entry: KnowledgeEntryItem;
}) {
  const t = useTranslations('knowledge');
  const { closeMenu } = useTableRowActions();

  return (
    <KnowledgeNoteFormDialog
      assignableVisibilities={assignableVisibilities}
      entry={entry}
      title={t('editNoteTitle')}
      triggerClassName={tableRowActionClassNameFor()}
      triggerLabel={t('edit')}
      onClose={closeMenu}
      onSubmit={(updates, closeDialog) => {
        onUpdate(entry.id, updates);
        closeDialog();
      }}
    />
  );
}
