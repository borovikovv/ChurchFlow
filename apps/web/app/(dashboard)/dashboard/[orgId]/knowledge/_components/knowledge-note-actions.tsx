'use client';

import { useTranslations } from 'next-intl';
import type { KnowledgeEntryItem, KnowledgeVisibility } from '@churchflow/shared';
import { EditIcon, PinIcon } from '@/components/icons/action-icons';
import { Button } from '@/components/ui/button';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';
import { TableRowActions, tableRowActionClassNameFor } from '@/components/ui/table-row-actions';
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
  const pinLabel = entry.pinned ? t('unpin') : t('pin');

  return (
    <div className="flex items-center gap-2">
      <Button
        aria-label={pinLabel}
        aria-pressed={entry.pinned}
        disabled={disabled}
        size="icon"
        title={pinLabel}
        type="button"
        variant="secondary"
        onClick={() => onUpdate(entry.id, { pinned: !entry.pinned })}
      >
        <PinIcon className="h-4 w-4" filled={entry.pinned} />
      </Button>
      <KnowledgeNoteFormDialog
        assignableVisibilities={assignableVisibilities}
        entry={entry}
        title={t('editNoteTitle')}
        triggerClassName="gap-2"
        triggerLabel={
          <>
            <EditIcon className="h-4 w-4" />
            {t('edit')}
          </>
        }
        triggerVariant="secondary"
        onSubmit={(updates, closeDialog) => {
          onUpdate(entry.id, updates, closeDialog);
        }}
      />
      <TableRowActions appearance="outline" className="group relative" label={t('noteActions')}>
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
    </div>
  );
}
