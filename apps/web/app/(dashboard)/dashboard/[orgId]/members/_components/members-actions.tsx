'use client';

import { useTranslations } from 'next-intl';
import type { OrganizationGroupBadge } from '@churchflow/shared';
import { useState, type ComponentProps } from 'react';
import { InviteAppUserForm } from '@/components/members/invite-app-user-form';
import { PlusIcon } from '@/components/icons/action-icons';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { FormDialog } from '@/components/ui/form-dialog';
import { useRefreshMembers } from '../_hooks/use-members-query';
import { CreateMemberDialog } from './create-member-dialog';
import { MemberCsvActions } from './member-csv-actions';
import {
  MEMBERS_ACTION_BUTTON_CLASS_NAME,
  MEMBERS_FAB_CLASS_NAME,
  MEMBERS_MENU_BUTTON_CLASS_NAME,
  MEMBERS_SHEET_BUTTON_CLASS_NAME,
  MEMBERS_TOOLBAR_CLASS_NAME,
} from './members-actions.styles';

type ManageInvitationAction = ComponentProps<typeof InviteAppUserForm>['action'];

export function MembersActions({
  groupOptions,
  manageInvitation,
  organizationId,
  variant,
}: {
  groupOptions: OrganizationGroupBadge[];
  manageInvitation: ManageInvitationAction;
  organizationId: string;
  variant: 'toolbar' | 'fab';
}) {
  const t = useTranslations('members');
  const [inviteFormKey, setInviteFormKey] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const refreshMembers = useRefreshMembers(organizationId);

  const resetInviteForm = () => setInviteFormKey((current) => current + 1);

  if (variant === 'fab') {
    return (
      <>
        <button
          aria-label={t('memberActionsTitle')}
          className={MEMBERS_FAB_CLASS_NAME}
          type="button"
          onClick={() => setSheetOpen(true)}
        >
          <PlusIcon className="h-7 w-7" />
        </button>
        <BottomSheet
          open={sheetOpen}
          title={t('memberActionsTitle')}
          onClose={() => setSheetOpen(false)}
        >
          <div className="grid gap-2 px-5 pt-1 pb-4">
            <CreateMemberDialog
              groupOptions={groupOptions}
              organizationId={organizationId}
              triggerClassName={MEMBERS_SHEET_BUTTON_CLASS_NAME}
              onCreated={refreshMembers}
            />
            <FormDialog
              triggerClassName={MEMBERS_SHEET_BUTTON_CLASS_NAME}
              triggerLabel={t('inviteAppUser')}
              title={t('inviteTitle')}
              onOpen={resetInviteForm}
            >
              <p className="-mt-4 mb-0">{t('inviteDescription')}</p>
              <InviteAppUserForm
                key={inviteFormKey}
                organizationId={organizationId}
                action={manageInvitation}
              />
            </FormDialog>
            <MemberCsvActions
              organizationId={organizationId}
              triggerClassName={`${MEMBERS_SHEET_BUTTON_CLASS_NAME} !h-11 !min-h-11`}
              wrapperClassName="w-full"
              onImported={refreshMembers}
            />
          </div>
        </BottomSheet>
      </>
    );
  }

  return (
    <div className={MEMBERS_TOOLBAR_CLASS_NAME}>
      <FormDialog
        triggerClassName={`${MEMBERS_ACTION_BUTTON_CLASS_NAME} col-start-1 row-start-2 w-full xl:w-auto`}
        triggerLabel={t('inviteAppUser')}
        title={t('inviteTitle')}
        onOpen={resetInviteForm}
      >
        <p className="-mt-4 mb-0">{t('inviteDescription')}</p>
        <InviteAppUserForm
          key={inviteFormKey}
          organizationId={organizationId}
          action={manageInvitation}
        />
      </FormDialog>
      <CreateMemberDialog
        groupOptions={groupOptions}
        organizationId={organizationId}
        triggerClassName={`${MEMBERS_ACTION_BUTTON_CLASS_NAME} col-start-2 row-start-2 w-full xl:w-auto`}
        onCreated={refreshMembers}
      />
      <MemberCsvActions
        organizationId={organizationId}
        triggerClassName={`${MEMBERS_MENU_BUTTON_CLASS_NAME} w-full xl:w-auto`}
        wrapperClassName="flex w-full xl:w-auto"
        onImported={refreshMembers}
      />
    </div>
  );
}
