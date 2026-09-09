'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import type { AddOrganizationGroupMembersInput } from '@churchflow/shared';
import { ORGANIZATION_GROUP_RESPONSIBILITY_MAX_LENGTH } from '@churchflow/shared';
import { FormInput } from '@/components/forms/form-input';
import { FormSelect } from '@/components/forms/form-select';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';

type GroupMemberInput = AddOrganizationGroupMembersInput['members'][number];

export function GroupMemberFormDialog({
  candidates,
  onSubmit,
}: {
  candidates: Array<{ id: string; displayName: string }>;
  onSubmit: (member: GroupMemberInput, closeDialog: () => void) => void;
}) {
  const t = useTranslations('groups');
  const commonT = useTranslations('common');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [membershipId, setMembershipId] = useState('');
  const [role, setRole] = useState<GroupMemberInput['role']>('MEMBER');
  const [responsibility, setResponsibility] = useState('');

  const reset = () => {
    setMembershipId('');
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
            disabled={!membershipId}
            type="button"
            onClick={() => {
              if (!membershipId) return;
              onSubmit(
                {
                  membershipId,
                  role,
                  responsibility: responsibility.trim() || null,
                },
                () => dialogRef.current?.close(),
              );
            }}
          >
            {t('addMember')}
          </Button>
        </div>
      }
    >
      <div className="stack">
        <FormSelect
          label={t('member')}
          value={membershipId}
          onChange={(event) => setMembershipId(event.target.value)}
        >
          <option value="">{t('selectMember')}</option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.displayName}
            </option>
          ))}
        </FormSelect>
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
