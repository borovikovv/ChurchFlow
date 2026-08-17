'use client';

import { useTranslations } from 'next-intl';
import type { PrayerRequestItem, UpdatePrayerRequestInput } from '@churchflow/shared';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';
import {
  TableRowAction,
  TableRowActions,
  tableRowActionClassNameFor,
} from '@/components/ui/table-row-actions';
import { PrayerRequestFormDialog } from './prayer-request-form-dialog';

export function PrayerRequestActions({
  disabled,
  request,
  onUpdate,
  onArchive,
  onRestore,
  onDelete,
}: {
  disabled: boolean;
  request: PrayerRequestItem;
  onUpdate: (requestId: string, request: UpdatePrayerRequestInput) => void;
  onArchive: (requestId: string) => void;
  onRestore: (requestId: string) => void;
  onDelete: (request: PrayerRequestItem) => Promise<void>;
}) {
  const t = useTranslations('prayerRequests');
  const commonT = useTranslations('common');

  if (!request.canEdit && !request.canArchive && !request.canRestore && !request.canDelete) {
    return null;
  }

  return (
    <TableRowActions label={t('actions')}>
      {request.canEdit ? (
        <PrayerRequestFormDialog
          initialRequest={request}
          title={t('editTitle')}
          triggerClassName="flex min-h-[38px] w-full cursor-pointer items-center justify-start rounded-md border-0 bg-transparent px-2.5 py-2 text-left font-medium text-[var(--foreground)] shadow-none hover:bg-[var(--surface-subtle)]"
          triggerLabel={t('edit')}
          submitLabel={t('save')}
          onSubmit={(updates, closeDialog) => {
            onUpdate(request.id, updates);
            closeDialog();
          }}
        />
      ) : null}
      {request.canArchive ? (
        <TableRowAction disabled={disabled} onSelect={() => onArchive(request.id)}>
          {t('archive')}
        </TableRowAction>
      ) : null}
      {request.canRestore ? (
        <TableRowAction disabled={disabled} onSelect={() => onRestore(request.id)}>
          {t('restore')}
        </TableRowAction>
      ) : null}
      {request.canDelete ? (
        <form
          className="contents"
          action={async () => {
            await onDelete(request);
          }}
        >
          <ConfirmSubmitButton
            cancelLabel={commonT('cancel')}
            confirmLabel={t('delete')}
            confirmVariant="danger"
            description={t('deleteDescription', { title: request.title })}
            pendingLabel={t('deleting')}
            title={t('deleteTitle')}
            triggerClassName={tableRowActionClassNameFor({ destructive: true })}
            triggerLabel={t('delete')}
            variant="ghost"
          />
        </form>
      ) : null}
    </TableRowActions>
  );
}
