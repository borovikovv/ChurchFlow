'use client';

import { useTranslations } from 'next-intl';
import { FormTextarea } from '@/components/forms/form-textarea';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';
import { manageOrganizationBillingExemption } from './organization-billing.actions';
import { toastActionResult } from './toast-action-result';

export function OrganizationExemptionForm({
  isExempt,
  organizationId,
  organizationName,
}: {
  isExempt: boolean;
  organizationId: string;
  organizationName: string;
}) {
  const t = useTranslations('adminPages');
  const commonT = useTranslations('common');

  const formAction = async (formData: FormData) => {
    toastActionResult(await manageOrganizationBillingExemption(formData));
  };

  const detail = (key: string) => t(`organizationDetail.${key}`);

  if (isExempt) {
    return (
      <form className="actions" action={formAction}>
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="intent" value="revoke" />
        <ConfirmSubmitButton
          cancelLabel={commonT('cancel')}
          confirmLabel={detail('revokeExemptionConfirm')}
          confirmVariant="danger"
          description={t('organizationDetail.revokeExemptionDescription', {
            name: organizationName,
          })}
          pendingLabel={commonT('saving')}
          title={detail('revokeExemptionTitle')}
          triggerLabel={detail('revokeExemption')}
          variant="danger"
        />
      </form>
    );
  }

  return (
    <form className="grid max-w-md gap-3" action={formAction}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="intent" value="grant" />
      <FormTextarea
        label={detail('exemptionReason')}
        maxLength={500}
        name="reason"
        required
        rows={3}
      />
      <div className="actions">
        <ConfirmSubmitButton
          cancelLabel={commonT('cancel')}
          confirmLabel={detail('grantExemptionConfirm')}
          description={t('organizationDetail.grantExemptionDescription', {
            name: organizationName,
          })}
          pendingLabel={commonT('saving')}
          title={detail('grantExemptionTitle')}
          triggerLabel={detail('grantExemption')}
          variant="primary"
        />
      </div>
    </form>
  );
}
