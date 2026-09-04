'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useActionState, useId, useRef, useState, type RefObject } from 'react';
import { FormInput } from '@/components/forms/form-input';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import {
  TableRowAction,
  TableRowActions,
  tableRowActionClassNameFor,
} from '@/components/ui/table-row-actions';
import {
  manageOrganizationBillingExemption,
  type OrganizationBillingActionState,
} from './organization-billing.actions';

const initialState: OrganizationBillingActionState = { message: null, error: null };

/**
 * Rendered only for platform admins, and only on organization rows: a request has no
 * subscription to be exempt from. The caller keys this on `isExempt` so a successful grant
 * remounts it, which both resets the action state and closes the menu.
 */
export function OrganizationRowActions({
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
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = useId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    manageOrganizationBillingExemption,
    initialState,
  );

  const detail = (key: string) => t(`organizationDetail.${key}`);

  return (
    <TableRowActions
      ignoreOutsideClickRefs={[dialogRef as RefObject<Element | null>]}
      label={t('tables.actionsFor', { name: organizationName })}
      outsideClickDisabled={dialogOpen}
    >
      <TableRowAction
        onSelect={() => router.push(`/admin/organizations/${organizationId}` as Route)}
      >
        {t('organizations.adminPage')}
      </TableRowAction>
      <FormDialog
        dialogRef={dialogRef}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
              {commonT('cancel')}
            </Button>
            <Button
              disabled={pending}
              form={formId}
              type="submit"
              variant={isExempt ? 'danger' : 'primary'}
            >
              {pending
                ? commonT('saving')
                : isExempt
                  ? detail('revokeExemptionConfirm')
                  : detail('grantExemptionConfirm')}
            </Button>
          </>
        }
        title={isExempt ? detail('revokeExemptionTitle') : detail('grantExemptionTitle')}
        triggerClassName={tableRowActionClassNameFor({ destructive: isExempt })}
        triggerLabel={isExempt ? detail('revokeExemption') : detail('grantExemption')}
        triggerVariant="ghost"
        onClose={() => setDialogOpen(false)}
        onOpen={() => setDialogOpen(true)}
      >
        <form action={formAction} className="grid gap-4" id={formId}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="intent" value={isExempt ? 'revoke' : 'grant'} />
          <p className="m-0">
            {t(
              isExempt
                ? 'organizationDetail.revokeExemptionDescription'
                : 'organizationDetail.grantExemptionDescription',
              { name: organizationName },
            )}
          </p>
          {isExempt ? null : (
            <FormInput label={detail('exemptionReason')} maxLength={500} name="reason" required />
          )}
          {state.error ? <p className="form-error m-0">{state.error}</p> : null}
        </form>
      </FormDialog>
    </TableRowActions>
  );
}
