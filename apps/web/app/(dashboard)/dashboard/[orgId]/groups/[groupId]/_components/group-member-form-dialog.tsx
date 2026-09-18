'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import type { AddOrganizationGroupMembersInput } from '@churchflow/shared';
import {
  ORGANIZATION_GROUP_MEMBERS_MAX_PER_ADD,
  ORGANIZATION_GROUP_RESPONSIBILITY_MAX_LENGTH,
} from '@churchflow/shared';
import { FormInput } from '@/components/forms/form-input';
import { FormMultiSelect } from '@/components/forms/form-multi-select';
import { FormSelect } from '@/components/forms/form-select';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';

type GroupMemberInput = AddOrganizationGroupMembersInput['members'][number];

export function GroupMemberFormDialog({
  candidates,
  onSubmit,
}: {
  candidates: Array<{ id: string; displayName: string }>;
  onSubmit: (members: GroupMemberInput[], closeDialog: () => void) => void;
}) {
  const t = useTranslations('groups');
  const commonT = useTranslations('common');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [membershipIds, setMembershipIds] = useState<string[]>([]);
  const [role, setRole] = useState<GroupMemberInput['role']>('MEMBER');
  const [responsibility, setResponsibility] = useState('');

  const limitReached = membershipIds.length >= ORGANIZATION_GROUP_MEMBERS_MAX_PER_ADD;
  const options = candidates.map((candidate) => ({
    isDisabled: limitReached,
    label: candidate.displayName,
    value: candidate.id,
  }));

  const reset = () => {
    setMembershipIds([]);
    setRole('MEMBER');
    setResponsibility('');
  };

  return (
    <FormDialog
      dialogRef={dialogRef}
      fullScreenOnMobile
      title={t('addMemberTitle')}
      triggerDisabled={candidates.length === 0}
      triggerLabel={t('addMember')}
      onOpen={reset}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            {commonT('cancel')}
          </Button>
          <Button
            disabled={membershipIds.length === 0}
            type="button"
            onClick={() => {
              if (membershipIds.length === 0) return;
              const trimmedResponsibility = responsibility.trim() || null;
              onSubmit(
                membershipIds.map((membershipId) => ({
                  membershipId,
                  role,
                  responsibility: trimmedResponsibility,
                })),
                () => dialogRef.current?.close(),
              );
            }}
          >
            {membershipIds.length > 0
              ? t('addSelectedMembers', { count: membershipIds.length })
              : t('addMember')}
          </Button>
        </div>
      }
    >
      <div className="stack">
        <FormMultiSelect
          allowMobileKeyboard
          label={t('members')}
          noOptionsMessage={t('noCandidatesFound')}
          options={options}
          placeholder={t('selectMembers')}
          value={membershipIds}
          onChange={setMembershipIds}
        />
        {limitReached ? (
          <p className="m-0 text-sm text-[var(--muted)]" aria-live="polite">
            {t('selectionLimit', { max: ORGANIZATION_GROUP_MEMBERS_MAX_PER_ADD })}
          </p>
        ) : null}
        <FormSelect
          label={t('roleLabel')}
          value={role}
          onChange={(event) => setRole(event.target.value as GroupMemberInput['role'])}
        >
          <option value="MEMBER">{t('roles.MEMBER')}</option>
          <option value="LEADER">{t('roles.LEADER')}</option>
        </FormSelect>
        <FormInput
          label={t('responsibilityLabel')}
          maxLength={ORGANIZATION_GROUP_RESPONSIBILITY_MAX_LENGTH}
          placeholder={t('responsibilityPlaceholder')}
          value={responsibility}
          onChange={(event) => setResponsibility(event.target.value)}
        />
      </div>
    </FormDialog>
  );
}
