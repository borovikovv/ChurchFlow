'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { CopyField } from '@/components/copy-field';
import { FormSelect } from '@/components/forms/form-select';
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
  const t = useTranslations('members');
  const commonT = useTranslations('common');
  const [state, formAction, pending] = useActionState(action, initialState);

  if (state.invitationId && state.inviteUrl) {
    return (
      <div className="grid gap-4">
        {state.message ? <p className="m-0 text-[var(--success)]">{state.message}</p> : null}
        {state.error ? <p className="form-error m-0">{state.error}</p> : null}
        <label>
          {t('invitationUrl')}
          <CopyField value={state.inviteUrl} />
        </label>
        <form action={formAction} className="flex justify-end">
          <input type="hidden" name="intent" value="revoke" />
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="invitationId" value={state.invitationId} />
          <Button disabled={pending} type="submit" variant="danger">
            {pending ? t('revoking') : t('revokeInvitation')}
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
        {commonT('email')}
        <span className="text-xs font-normal text-[var(--muted)]">{t('emailOptional')}</span>
        <input name="notificationEmail" type="email" placeholder="member@example.com" />
      </label>
      <FormSelect label={t('role')} name="role" defaultValue="MEMBER">
        <option value="MEMBER">{t('member')}</option>
        <option value="VIEWER">{t('viewer')}</option>
      </FormSelect>
      <Button disabled={pending} type="submit">
        {pending ? t('creating') : t('createInvitation')}
      </Button>
    </form>
  );
}
