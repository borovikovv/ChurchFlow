'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { CreateOrganizationGroupInput, OrganizationGroupListItem } from '@churchflow/shared';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';
import {
  TableRowActions,
  tableRowActionClassNameFor,
  useTableRowActions,
} from '@/components/ui/table-row-actions';
import { serviceRoleLabel } from '@/features/groups/lib/service-role-labels';
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
  const locale = useLocale();

  return (
    <TableRowActions label={t('actions')}>
      <EditGroupAction group={group} onUpdate={onUpdate} />
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
          notice={
            group.serviceRoles.length > 0
              ? t('deleteServiceRolesNotice', {
                  roles: group.serviceRoles
                    .map((role) => serviceRoleLabel(locale, role))
                    .join(', '),
                })
              : undefined
          }
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

function EditGroupAction({
  group,
  onUpdate,
}: {
  group: OrganizationGroupListItem;
  onUpdate: (groupId: string, group: CreateOrganizationGroupInput) => void;
}) {
  const t = useTranslations('groups');
  const commonT = useTranslations('common');
  const { closeMenu } = useTableRowActions();

  return (
    <GroupFormDialog
      group={group}
      title={t('editTitle')}
      triggerClassName={tableRowActionClassNameFor({ destructive: false })}
      triggerLabel={t('edit')}
      triggerVariant="ghost"
      submitLabel={commonT('save')}
      onClose={closeMenu}
      onSubmit={(updates, closeDialog) => {
        onUpdate(group.id, updates);
        closeDialog();
      }}
    />
  );
}
