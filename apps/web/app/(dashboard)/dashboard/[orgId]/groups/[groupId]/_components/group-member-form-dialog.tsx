'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import type { AddOrganizationGroupMembersInput } from '@churchflow/shared';
import {
  ORGANIZATION_GROUP_MEMBERS_MAX_PER_ADD,
  ORGANIZATION_GROUP_RESPONSIBILITY_MAX_LENGTH,
} from '@churchflow/shared';
import { FormCheckbox } from '@/components/forms/form-checkbox';
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
  onSubmit: (members: GroupMemberInput[], closeDialog: () => void) => void;
}) {
  const t = useTranslations('groups');
  const commonT = useTranslations('common');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [role, setRole] = useState<GroupMemberInput['role']>('MEMBER');
  const [responsibility, setResponsibility] = useState('');

  const normalizedQuery = query.trim().toLowerCase();
  // Selected people stay visible while filtering so the batch can be reviewed before submit.
  const visibleCandidates = candidates.filter(
    (candidate) =>
      selectedIds.has(candidate.id) ||
      candidate.displayName.toLowerCase().includes(normalizedQuery),
  );
  const limitReached = selectedIds.size >= ORGANIZATION_GROUP_MEMBERS_MAX_PER_ADD;

  const reset = () => {
    setQuery('');
    setSelectedIds(new Set());
    setRole('MEMBER');
    setResponsibility('');
  };

  const toggleCandidate = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
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
            disabled={selectedIds.size === 0}
            type="button"
            onClick={() => {
              if (selectedIds.size === 0) return;
              const trimmedResponsibility = responsibility.trim() || null;
              onSubmit(
                Array.from(selectedIds, (membershipId) => ({
                  membershipId,
                  role,
                  responsibility: trimmedResponsibility,
                })),
                () => dialogRef.current?.close(),
              );
            }}
          >
            {selectedIds.size > 0
              ? t('addSelectedMembers', { count: selectedIds.size })
              : t('addMember')}
          </Button>
        </div>
      }
    >
      <div className="stack">
        <FormInput
          label={t('searchCandidates')}
          placeholder={t('searchCandidatesPlaceholder')}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <fieldset className="grid gap-2 rounded-md border border-[var(--line)] p-3">
          <legend className="px-1 font-semibold">{t('members')}</legend>
          {visibleCandidates.length === 0 ? (
            <p className="m-0 text-sm text-[var(--muted)]">{t('noCandidatesFound')}</p>
          ) : (
            <div className="grid max-h-64 gap-2 overflow-y-auto">
              {visibleCandidates.map((candidate) => {
                const checked = selectedIds.has(candidate.id);
                return (
                  <FormCheckbox
                    key={candidate.id}
                    checked={checked}
                    disabled={!checked && limitReached}
                    label={candidate.displayName}
                    value={candidate.id}
                    onChange={(event) => toggleCandidate(candidate.id, event.target.checked)}
                  />
                );
              })}
            </div>
          )}
          <p className="m-0 text-sm text-[var(--muted)]" aria-live="polite">
            {t('selectedCount', { count: selectedIds.size })}
            {limitReached
              ? ` ${t('selectionLimit', { max: ORGANIZATION_GROUP_MEMBERS_MAX_PER_ADD })}`
              : null}
          </p>
        </fieldset>
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
