'use client';

import { useTranslations } from 'next-intl';
import type { ImportantDateItem, KnowledgeVisibility } from '@churchflow/shared';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';
import {
  TableRowActions,
  tableRowActionClassNameFor,
  useTableRowActions,
} from '@/components/ui/table-row-actions';
import { ImportantDateFormDialog } from './important-date-form-dialog';
import type { ImportantDatesListProps } from './knowledge-lists.types';

export function ImportantDateActions({
  assignableVisibilities,
  date,
  onDelete,
  onUpdate,
}: Pick<ImportantDatesListProps, 'onDelete' | 'onUpdate'> & {
  assignableVisibilities: KnowledgeVisibility[];
  date: ImportantDateItem;
}) {
  const t = useTranslations('knowledge');

  return (
    <TableRowActions label={t('dateActions')}>
      <EditDateAction
        assignableVisibilities={assignableVisibilities}
        date={date}
        onUpdate={onUpdate}
      />
      <form
        className="contents"
        action={async () => {
          await onDelete(date);
        }}
      >
        <ConfirmSubmitButton
          cancelLabel={t('cancel')}
          confirmLabel={t('delete')}
          confirmVariant="danger"
          description={t('deleteDateDescription', { title: date.title })}
          pendingLabel={t('deleting')}
          title={t('deleteDateTitle')}
          triggerClassName={tableRowActionClassNameFor({ destructive: true })}
          triggerLabel={t('delete')}
          variant="ghost"
        />
      </form>
    </TableRowActions>
  );
}

function EditDateAction({
  assignableVisibilities,
  date,
  onUpdate,
}: Pick<ImportantDatesListProps, 'onUpdate'> & {
  assignableVisibilities: KnowledgeVisibility[];
  date: ImportantDateItem;
}) {
  const t = useTranslations('knowledge');
  const { closeMenu } = useTableRowActions();

  return (
    <ImportantDateFormDialog
      assignableVisibilities={assignableVisibilities}
      date={date}
      title={t('editDateTitle')}
      triggerClassName={tableRowActionClassNameFor()}
      triggerLabel={t('edit')}
      onClose={closeMenu}
      onSubmit={(updates, closeDialog) => {
        onUpdate(date.id, updates);
        closeDialog();
      }}
    />
  );
}
