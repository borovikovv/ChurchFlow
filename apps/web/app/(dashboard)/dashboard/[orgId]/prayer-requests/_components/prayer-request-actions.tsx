'use client';

import { useTranslations } from 'next-intl';
import type {
  ArchivePrayerRequestInput,
  PrayerRequestItem,
  UpdatePrayerRequestInput,
} from '@churchflow/shared';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';
import {
  TableRowAction,
  TableRowActions,
  tableRowActionClassNameFor,
  useTableRowActions,
} from '@/components/ui/table-row-actions';
import { PrayerRequestArchiveDialog } from './prayer-request-archive-dialog';
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
  onArchive: (requestId: string, request: ArchivePrayerRequestInput) => void;
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
      <PrayerRequestDialogActions
        disabled={disabled}
        request={request}
        onArchive={onArchive}
        onUpdate={onUpdate}
      />
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

function PrayerRequestDialogActions({
  disabled,
  request,
  onArchive,
  onUpdate,
}: {
  disabled: boolean;
  request: PrayerRequestItem;
  onArchive: (requestId: string, request: ArchivePrayerRequestInput) => void;
  onUpdate: (requestId: string, request: UpdatePrayerRequestInput) => void;
}) {
  const t = useTranslations('prayerRequests');
  const { closeMenu } = useTableRowActions();

  return (
    <>
      {request.canEdit ? (
        <PrayerRequestFormDialog
          initialRequest={request}
          title={t('editTitle')}
          triggerClassName={tableRowActionClassNameFor()}
          triggerLabel={t('edit')}
          submitLabel={t('save')}
          onClose={closeMenu}
          onSubmit={(updates, closeDialog) => {
            onUpdate(request.id, updates);
            closeDialog();
          }}
        />
      ) : null}
      {request.canArchive ? (
        <PrayerRequestArchiveDialog
          disabled={disabled}
          request={request}
          onArchive={onArchive}
          onClose={closeMenu}
        />
      ) : null}
    </>
  );
}
