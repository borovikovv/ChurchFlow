'use client';

import { useActionState } from 'react';
import { CopyField } from '@/components/copy-field';
import { FormDialog } from '@/components/ui/form-dialog';
import { Button } from '@/components/ui/button';
import { manageMemberAccess } from './member-access.actions';
import type {
  GiveMemberAccessDialogProps,
  MemberAccessActionState,
} from './member-access.types';

const initialState: MemberAccessActionState = {
  claimId: null,
  claimUrl: null,
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
  triggerClassName,
}: GiveMemberAccessDialogProps) {
  const [state, formAction, pending] = useActionState(manageMemberAccess, initialState);

  return (
    <FormDialog
      title={`Give app access to ${memberName}`}
      triggerClassName={triggerClassName}
      triggerLabel={
        <>
          <AccessIcon />
          Give app access
        </>
      }
      triggerVariant="ghost"
    >
      {state.claimId && state.claimUrl ? (
        <div className="grid gap-4">
          {state.message ? <p className="m-0 text-[var(--success)]">{state.message}</p> : null}
          {state.error ? <p className="form-error m-0">{state.error}</p> : null}
          <label>
            Access URL
            <CopyField value={state.claimUrl} />
          </label>
          <form action={formAction} className="flex justify-end">
            <input type="hidden" name="intent" value="revoke" />
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="claimId" value={state.claimId} />
            <Button disabled={pending} type="submit" variant="danger">
              {pending ? 'Revoking…' : 'Revoke access link'}
            </Button>
          </form>
        </div>
      ) : (
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="intent" value="create" />
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="membershipId" value={membershipId} />
          <p className="m-0">
            Generate a private link for <strong>{memberName}</strong>.
            {memberEmail ? ` We will also email it to ${memberEmail}.` : null}
          </p>
          {state.message ? <p className="m-0 text-[var(--success)]">{state.message}</p> : null}
          {state.error ? <p className="form-error m-0">{state.error}</p> : null}
          <Button disabled={pending} type="submit">
            {pending ? 'Generating…' : 'Generate access link'}
          </Button>
        </form>
      )}
    </FormDialog>
  );
}
