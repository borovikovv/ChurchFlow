'use client';

import { useTranslations } from 'next-intl';
import type { CreateOrganizationGroupInput, OrganizationGroupListItem } from '@churchflow/shared';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';
import {
  TableRowActions,
  tableRowActionClassNameFor,
} from '@/components/ui/table-row-actions';
import { GroupFormDialog } from './group-form-dialog';

export function GroupRowActions({
  group,
  onDelete,
  onUpdate,
}: {
  group: OrganizationGroupListItem;
  onDelete: (group: OrganizationGroupListItem) => Promise<void>;
  onUpdate: (groupId: string, group: CreateOrganizationGroupInput) => void;
}) {
  const t = useTranslations('groups');
  const commonT = useTranslations('common');

  return (
    <TableRowActions label={t('actions')}>
      <GroupFormDialog
        group={group}
        title={t('editTitle')}
        triggerClassName={tableRowActionClassNameFor({ destructive: false })}
        triggerLabel={t('edit')}
        triggerVariant="ghost"
        submitLabel={commonT('save')}
        onSubmit={(updates, closeDialog) => {
          onUpdate(group.id, updates);
          closeDialog();
        }}
      />
      <form
        className="contents"
        action={async () => {
          await onDelete(group);
        }}
      >
        <ConfirmSubmitButton
          cancelLabel={commonT('cancel')}
          confirmLabel={t('delete')}
          confirmVariant="danger"
          description={t('deleteDescription', { name: group.name })}
          pendingLabel={t('deleting')}
          title={t('deleteTitle')}
          triggerClassName={tableRowActionClassNameFor({ destructive: true })}
          triggerLabel={t('delete')}
          variant="ghost"
        />
      </form>
    </TableRowActions>
  );
}
