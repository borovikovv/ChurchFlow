'use client';

import { useActionState } from 'react';
import { CopyField } from '@/components/copy-field';
import { Button } from '@/components/ui/button';

export interface InlineInvitationState {
  invitationId: string | null;
  inviteUrl: string | null;
  message: string | null;
  error: string | null;
}

type InvitationAction = (
  state: InlineInvitationState,
  formData: FormData,
) => Promise<InlineInvitationState>;

const initialState: InlineInvitationState = {
  invitationId: null,
  inviteUrl: null,
  message: null,
  error: null,
};

export function InviteAppUserForm({
  organizationId,
  action,
}: {
  organizationId: string;
  action: InvitationAction;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  if (state.invitationId && state.inviteUrl) {
    return (
      <div className="grid gap-4">
        {state.message ? <p className="m-0 text-[var(--success)]">{state.message}</p> : null}
        {state.error ? <p className="form-error m-0">{state.error}</p> : null}
        <label>
          Invitation URL
          <CopyField value={state.inviteUrl} />
        </label>
        <form action={formAction} className="flex justify-end">
          <input type="hidden" name="intent" value="revoke" />
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="invitationId" value={state.invitationId} />
          <Button disabled={pending} type="submit" variant="danger">
            {pending ? 'Revoking…' : 'Revoke invitation'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form className="grid gap-4" action={formAction}>
      <input type="hidden" name="intent" value="create" />
      <input type="hidden" name="organizationId" value={organizationId} />
      {state.message ? <p className="m-0 text-[var(--success)]">{state.message}</p> : null}
      {state.error ? <p className="form-error m-0">{state.error}</p> : null}
      <label>
        Email
        <span className="text-xs font-normal text-[var(--muted)]">Optional</span>
        <input name="notificationEmail" type="email" placeholder="member@example.com" />
      </label>
      <label>
        Role
        <select name="role" defaultValue="MEMBER">
          <option value="MEMBER">Member</option>
          <option value="VIEWER">Viewer</option>
        </select>
      </label>
      <Button disabled={pending} type="submit">
        {pending ? 'Creating…' : 'Create invitation'}
      </Button>
    </form>
  );
}
