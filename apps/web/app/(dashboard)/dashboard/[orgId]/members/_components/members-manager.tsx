'use client';

import { useState, type ComponentProps } from 'react';
import { InviteAppUserForm } from '@/components/members/invite-app-user-form';
import { MemberActions, MemberRoleStatus } from '@/components/members/member-actions';
import { FormDialog } from '@/components/ui/form-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs } from '@/components/ui/tabs';
import type { OrganizationMember, OrganizationRole } from '../types';
import { CreateMemberDialog } from './create-member-dialog';
import { MemberAvatar } from './member-avatar';
import { MemberContactSummary, MemberIdentitySummary } from './member-summary';

type MemberActionProps = Pick<
  ComponentProps<typeof MemberActions>,
  | 'updateProfile'
  | 'updateRole'
  | 'removeMember'
  | 'claimAction'
  | 'createRelationship'
  | 'deleteRelationship'
  | 'preparePhoto'
  | 'confirmPhoto'
>;

export function MembersManager({
  organizationId,
  initialMembers,
  actorMembershipId,
  actorRole,
  tabs,
  manageInvitation,
  ...actions
}: {
  organizationId: string;
  initialMembers: OrganizationMember[];
  actorMembershipId: string | null;
  actorRole: OrganizationRole | null;
  tabs: ComponentProps<typeof Tabs>['items'];
  manageInvitation: ComponentProps<typeof InviteAppUserForm>['action'];
} & MemberActionProps) {
  const [members, setMembers] = useState(initialMembers);
  const canManage = actorRole === 'OWNER' || actorRole === 'ADMIN';
  const isOwner = actorRole === 'OWNER';

  return (
    <>
      <div className="flex flex-col items-stretch gap-4 border-b border-[var(--line)] md:flex-row md:items-end md:justify-between [&_.ui-tabs]:flex-1 [&_.ui-tabs]:border-b-0">
        <Tabs label="Member access filters" items={tabs} />
        {canManage ? (
          <div className="flex shrink-0 justify-end gap-2 pb-2">
            <FormDialog triggerLabel="Invite app user" title="Invite an app user">
              <p className="-mt-4 mb-0">
                Send an email invitation or generate a link you can share yourself.
              </p>
              <InviteAppUserForm organizationId={organizationId} action={manageInvitation} />
            </FormDialog>
            <CreateMemberDialog
              organizationId={organizationId}
              onCreated={(created) => {
                setMembers((current) => [
                  {
                    ...created,
                    role: created.role as OrganizationRole,
                    status: 'ACTIVE',
                    accountState: 'UNCLAIMED',
                    claimedAt: null,
                    profile: {
                      ...created.profile,
                      notes: null,
                      memberSince: null,
                      biography: null,
                      familyNotes: null,
                      profilePhotoAssetId: null,
                      photoUrl: null,
                    },
                    user: null,
                    activeClaim: null,
                    relationships: [],
                  },
                  ...current,
                ]);
              }}
            />
          </div>
        ) : null}
      </div>

      <section className="stack">
        <h2>Organization members</h2>
        <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <div
            className="hidden grid-cols-[minmax(180px,1.4fr)_minmax(180px,1.2fr)_minmax(150px,1fr)_100px_44px] items-center gap-4 border-b border-[var(--line-muted)] bg-[var(--surface-subtle)] px-4 py-[11px] text-xs font-semibold text-[var(--muted)] md:grid"
            aria-hidden="true"
          >
            <span>Member</span>
            <span>Contact</span>
            <span>Access</span>
            <span>Status</span>
            <span />
          </div>
          {members.map((member) => (
            <article
              className="grid min-h-[68px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-[var(--line-muted)] px-4 py-[11px] last:border-b-0 md:grid-cols-[minmax(180px,1.4fr)_minmax(180px,1.2fr)_minmax(150px,1fr)_100px_44px] md:gap-4"
              key={member.id}
            >
              <div className="flex min-w-0 items-center gap-3">
                <MemberAvatar
                  displayName={member.profile.displayName}
                  url={member.profile.photoUrl}
                />
                <MemberIdentitySummary source={member.source} profile={member.profile} />
              </div>
              <MemberContactSummary profile={member.profile} />
              <div className="col-start-1 grid min-w-0 gap-[3px] md:col-auto">
                <StatusBadge status={member.accountState} />
                {member.activeClaim?.status === 'REQUESTED' ? (
                  <small className="truncate text-[var(--muted)]">
                    Requested by {member.activeClaim.requestedBy?.displayName ?? 'Telegram user'}
                  </small>
                ) : null}
              </div>
              <div className="col-start-1 md:col-auto">
                <MemberRoleStatus role={member.role} />
              </div>
              <MemberActions
                {...actions}
                member={member}
                organizationId={organizationId}
                canManage={canManage}
                isOwner={isOwner}
                isCurrentMember={member.id === actorMembershipId}
                memberCandidates={members.map(({ id, profile }) => ({
                  id,
                  displayName: profile.displayName,
                }))}
                onProfileUpdated={(profile) => {
                  setMembers((current) =>
                    current.map((item) =>
                      item.id === member.id
                        ? { ...item, profile: { ...item.profile, ...profile } }
                        : item,
                    ),
                  );
                }}
                onRoleUpdated={(role) => {
                  setMembers((current) =>
                    current.map((item) => (item.id === member.id ? { ...item, role } : item)),
                  );
                }}
              />
            </article>
          ))}
          {members.length === 0 ? (
            <p className="m-0 px-4 py-8 text-center">No members match this filter.</p>
          ) : null}
        </div>
      </section>
    </>
  );
}
