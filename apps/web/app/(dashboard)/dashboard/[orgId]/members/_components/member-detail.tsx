'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { EditMemberDialog } from '@/components/members/member-actions';
import type { MemberProfileUpdate } from '@/components/members/member-actions';
import { organizationMembersRoute } from '@/features/organizations/routes';
import type { MembersPayload, OrganizationMember } from '../types';
import { MemberAvatar } from './member-avatar';

type EditMemberDialogProps = ComponentProps<typeof EditMemberDialog>;

type DetailActionProps = Pick<
  EditMemberDialogProps,
  'action' | 'createRelationship' | 'deleteRelationship' | 'preparePhoto' | 'confirmPhoto'
>;

const EMPTY_FIELD_VALUE = '-';

export function MemberDetail({
  member: initialMember,
  organizationId,
  payload,
  ...actions
}: {
  member: OrganizationMember;
  organizationId: string;
  payload: MembersPayload;
} & DetailActionProps) {
  const t = useTranslations('members');
  const commonT = useTranslations('common');
  const profileT = useTranslations('profile');
  const locale = useLocale();
  const router = useRouter();
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const [member, setMember] = useState(initialMember);
  const canManage = payload.actorRole === 'OWNER' || payload.actorRole === 'ADMIN';
  const canEditProfile = canManage || member.id === payload.actorMembershipId;
  const canEditRelationships = canManage || member.id === payload.actorMembershipId;
  const memberCandidates = payload.memberCandidates;

  function updateProfile(updates: MemberProfileUpdate) {
    const { ministries, ...profileUpdates } = updates;
    setMember((current) => ({
      ...current,
      ...(ministries ? { ministries } : {}),
      profile: {
        ...current.profile,
        ...profileUpdates,
      },
    }));
  }

  function updateRelationships(relationships?: OrganizationMember['relationships']) {
    if (!relationships) {
      router.refresh();
      return;
    }

    setMember((current) => ({
      ...current,
      relationships,
    }));
    router.refresh();
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <ButtonLink
          className="w-full sm:w-auto"
          href={organizationMembersRoute(organizationId)}
          variant="secondary"
        >
          {t('backToMembers')}
        </ButtonLink>
        {canEditProfile ? (
          <EditMemberDialog
            {...actions}
            member={member}
            organizationId={organizationId}
            memberCandidates={memberCandidates}
            onProfileUpdated={updateProfile}
            onRelationshipsChanged={updateRelationships}
            canManageRelationships={canEditRelationships}
            dialogRef={editDialogRef}
            onOpen={() => undefined}
            onClose={() => undefined}
            renderTrigger={(openDialog) => (
              <Button className="w-full sm:w-auto" type="button" onClick={openDialog}>
                {commonT('edit')}
              </Button>
            )}
          />
        ) : null}
      </div>

      <header className="flex min-w-0 flex-col gap-4 border-b border-[var(--line-muted)] pb-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <MemberAvatar
            displayName={member.profile.displayName}
            url={member.profile.photoUrl}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-sm font-semibold text-[var(--muted)]">{t('memberDetails')}</p>
            <h1 className="mb-0 break-words text-3xl sm:text-4xl">{member.profile.displayName}</h1>
          </div>
        </div>
      </header>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <DetailSection title={t('profileSection')}>
            <DetailGrid>
              <DetailItem label={commonT('name')} value={member.profile.displayName} />
              <DetailItem label={commonT('email')} value={member.profile.email} />
              <DetailItem label={t('phone')} value={member.profile.phone} />
              <DetailItem
                label={t('memberSince')}
                value={formatDateValue(member.profile.memberSince, locale)}
              />
              <DetailItem
                label={t('birthday')}
                value={formatDateValue(member.profile.birthday, locale)}
              />
              <DetailItem
                label={t('anniversary')}
                value={formatDateValue(member.profile.anniversary, locale)}
              />
            </DetailGrid>
          </DetailSection>

          <DetailSection title={t('notesSection')}>
            <LongText label={t('notes')} value={member.profile.notes} />
            <LongText label={t('biography')} value={member.profile.biography} />
            <LongText label={t('familyNotes')} value={member.profile.familyNotes} />
          </DetailSection>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          {member.user ? (
            <DetailSection title={t('personalInformationSection')}>
              <DetailItem label={commonT('name')} value={member.user.displayName} />
              <DetailItem label={commonT('email')} value={member.user.email} />
              <DetailItem
                label={profileT('baptismDate')}
                value={formatDateValue(member.user.baptizedAt, locale)}
              />
              <DetailItem label={profileT('baptismChurch')} value={member.user.baptismChurchName} />
              <DetailItem label={profileT('platformRole')} value={member.user.platformRole} />
            </DetailSection>
          ) : null}

          <DetailSection title={t('ministries')}>
            {member.ministries.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {member.ministries.map((ministry) => (
                  <span
                    className="rounded-full border border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 py-1 text-sm font-semibold"
                    key={ministry}
                  >
                    {t(`ministry.${ministry}`)}
                  </span>
                ))}
              </div>
            ) : (
              <EmptyValue>{EMPTY_FIELD_VALUE}</EmptyValue>
            )}
          </DetailSection>

          <DetailSection title={t('familyRelationships')}>
            {member.relationships && member.relationships.length > 0 ? (
              <div className="flex flex-col gap-2">
                {member.relationships.map((relationship) => {
                  const other =
                    relationship.fromMembershipId === member.id
                      ? relationship.toMembership
                      : relationship.fromMembership;
                  return (
                    <div
                      className="flex min-w-0 flex-col gap-1 rounded-md border border-[var(--line-muted)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-start"
                      key={relationship.id}
                    >
                      <span className="min-w-0 break-words font-semibold">
                        {other.profile?.displayName ?? t('member')}
                      </span>
                      <span className="text-[var(--muted)]">
                        {t(`relationshipLabels.${relationship.type}`)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyValue>{t('noRelationships')}</EmptyValue>
            )}
          </DetailSection>
        </aside>
      </section>
    </div>
  );
}

function DetailSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h2 className="m-0">{title}</h2>
      <div className="flex min-w-0 flex-col gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
        {children}
      </div>
    </section>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-3 sm:grid-cols-2">{children}</div>;
}

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-bold uppercase text-[var(--muted)]">{label}</span>
      <span className="min-w-0 break-words font-semibold">{value || EMPTY_FIELD_VALUE}</span>
    </div>
  );
}

function LongText({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase text-[var(--muted)]">{label}</span>
      <p className="m-0 whitespace-pre-wrap text-[var(--foreground)]">
        {value || EMPTY_FIELD_VALUE}
      </p>
    </div>
  );
}

function EmptyValue({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[var(--muted)]">{children}</p>;
}

function formatDateValue(value: string | null | undefined, locale: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}
