'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormDialog } from '@/components/ui/form-dialog';
import { Button } from '@/components/ui/button';
import { formatIsoDate } from '@/lib/format-date';
import { AccessLinkPanel } from './access-link-panel';
import { manageMemberAccess } from './member-access.actions';
import type { GiveMemberAccessDialogProps, MemberAccessActionState } from './member-access.types';

const initialState: MemberAccessActionState = {
  claimId: null,
  claimUrl: null,
  expiresAt: null,
  message: null,
  error: null,
};

function AccessIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]"
      viewBox="0 0 24 24"
    >
      <path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}

export function GiveMemberAccessDialog({
  organizationId,
  membershipId,
  memberName,
  memberEmail,
  activeClaim,
  triggerClassName,
  dialogRef,
  onOpen,
  onClose,
}: GiveMemberAccessDialogProps) {
  const t = useTranslations('members');
  const [state, formAction, pending] = useActionState(manageMemberAccess, initialState);
  // A claim token is stored hashed, so an existing link can never be read back.
  // The member keeps a link until it expires; showing it again means issuing a new one.
  const hasIssuedClaim = Boolean(activeClaim);
  const issueLabel = hasIssuedClaim ? t('refreshAccessLink') : t('generateAccessLink');
  const issuePendingLabel = hasIssuedClaim ? t('refreshing') : t('generating');

  return (
    <FormDialog
      title={
        hasIssuedClaim
          ? t('accessLinkTitle', { name: memberName })
          : t('giveAppAccessTitle', { name: memberName })
      }
      triggerClassName={triggerClassName}
      triggerLabel={
        <>
          <AccessIcon />
          {hasIssuedClaim ? t('accessLink') : t('giveAppAccess')}
        </>
      }
      triggerVariant="ghost"
      {...(dialogRef ? { dialogRef } : {})}
      {...(onOpen ? { onOpen } : {})}
      {...(onClose ? { onClose } : {})}
    >
      {state.claimId && state.claimUrl ? (
        <div className="grid gap-4">
          {state.message ? <p className="m-0 text-[var(--success)]">{state.message}</p> : null}
          {state.error ? <p className="form-error m-0">{state.error}</p> : null}
          <AccessLinkPanel url={state.claimUrl} expiresAt={state.expiresAt} />
          <form action={formAction} className="flex justify-end">
            <input type="hidden" name="intent" value="revoke" />
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="claimId" value={state.claimId} />
            <Button disabled={pending} type="submit" variant="danger">
              {pending ? t('revoking') : t('revokeAccessLink')}
            </Button>
          </form>
        </div>
      ) : (
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="intent" value="create" />
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="membershipId" value={membershipId} />
          {activeClaim ? (
            <div className="grid gap-2">
              <p className="m-0">
                {t('accessLinkExpires', { date: formatIsoDate(activeClaim.expiresAt) })}
              </p>
              <p className="m-0 text-sm text-[var(--muted)]">{t('accessLinkReissueDescription')}</p>
            </div>
          ) : (
            <p className="m-0">
              {t('generateAccessLinkDescription', { name: memberName })}
              {memberEmail
                ? ` ${t('generateAccessLinkEmailDescription', { email: memberEmail })}`
                : null}
            </p>
          )}
          {state.message ? <p className="m-0 text-[var(--success)]">{state.message}</p> : null}
          {state.error ? <p className="form-error m-0">{state.error}</p> : null}
          <Button disabled={pending} type="submit">
            {pending ? issuePendingLabel : issueLabel}
          </Button>
        </form>
      )}
    </FormDialog>
  );
}
