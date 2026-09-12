'use client';

import { useTranslations } from 'next-intl';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';
import { manageOrganizationLifecycle } from './organization-lifecycle.actions';
import { toastActionResult } from './toast-action-result';

export function OrganizationLifecycleActions({
  organizationId,
  organizationName,
  status,
}: {
  organizationId: string;
  organizationName: string;
  status: string;
}) {
  const t = useTranslations('adminPages');
  const commonT = useTranslations('common');

  const formAction = async (formData: FormData) => {
    toastActionResult(await manageOrganizationLifecycle(formData));
  };

  const detail = (key: string) => t(`organizationDetail.${key}`);
  const describe = (key: string) => t(`organizationDetail.${key}`, { name: organizationName });

  return (
    <form className="actions" action={formAction}>
      <input type="hidden" name="organizationId" value={organizationId} />
      {status !== 'ACTIVE' ? (
        <ConfirmSubmitButton
          cancelLabel={commonT('cancel')}
          confirmLabel={detail('restoreConfirm')}
          description={describe('restoreDescription')}
          name="action"
          pendingLabel={commonT('saving')}
          title={detail('restoreTitle')}
          triggerLabel={detail('restore')}
          value="restore"
          variant="primary"
        />
      ) : null}
      {status !== 'SUSPENDED' && status !== 'DELETED' ? (
        <ConfirmSubmitButton
          cancelLabel={commonT('cancel')}
          confirmLabel={detail('suspendConfirm')}
          description={describe('suspendDescription')}
          name="action"
          pendingLabel={commonT('saving')}
          title={detail('suspendTitle')}
          triggerLabel={detail('suspend')}
          value="suspend"
        />
      ) : null}
      {status !== 'ARCHIVED' && status !== 'DELETED' ? (
        <ConfirmSubmitButton
          cancelLabel={commonT('cancel')}
          confirmLabel={detail('archiveConfirm')}
          description={describe('archiveDescription')}
          name="action"
          pendingLabel={commonT('saving')}
          title={detail('archiveTitle')}
          triggerLabel={detail('archive')}
          value="archive"
        />
      ) : null}
      {status !== 'DELETED' ? (
        <ConfirmSubmitButton
          cancelLabel={commonT('cancel')}
          confirmLabel={detail('softDeleteConfirm')}
          confirmVariant="danger"
          description={describe('softDeleteDescription')}
          name="action"
          pendingLabel={commonT('saving')}
          title={detail('softDeleteTitle')}
          triggerLabel={detail('softDelete')}
          value="delete-soft"
          variant="danger"
        />
      ) : null}
    </form>
  );
}
