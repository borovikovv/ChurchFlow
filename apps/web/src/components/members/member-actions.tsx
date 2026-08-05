'use client';

import { useTranslations } from 'next-intl';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';
import {
  TableRowAction,
  TableRowActions,
  tableRowActionClassNameFor,
} from '@/components/ui/table-row-actions';
import { GiveMemberAccessDialog } from './give-member-access-dialog';
import { MemberPhotoField, validateMemberPhoto } from './member-photo-upload';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  MEMBER_MINISTRIES,
  updateOrganizationMemberProfileSchema,
  type MemberMinistry,
  type UpdateOrganizationMemberProfileInput,
} from '@churchflow/shared';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { FormDatePicker } from '@/components/forms/form-date-picker';
import { FormInput } from '@/components/forms/form-input';
import { FormSelect } from '@/components/forms/form-select';
import { FormTextarea } from '@/components/forms/form-textarea';
import { FormCheckbox } from '@/components/forms/form-checkbox';

type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
type FormAction = (formData: FormData) => void | Promise<void>;
type RemoveMemberAction = (formData: FormData) => Promise<{ ok: boolean; error?: string }>;

export interface ProfileUpdateState {
  updated: boolean;
  error: string | null;
}

type ProfileUpdateAction = (
  state: ProfileUpdateState,
  formData: FormData,
) => Promise<ProfileUpdateState>;

type PrepareMemberPhotoAction = (input: {
  organizationId: string;
  membershipId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
}) => Promise<{ ok: boolean; error?: string; assetId?: string; uploadUrl?: string }>;

type ConfirmMemberPhotoAction = (input: {
  organizationId: string;
  membershipId: string;
  assetId: string;
}) => Promise<{ ok: boolean; error?: string; photoUrl?: string }>;

export interface RoleUpdateState {
  role: OrganizationRole;
  updated: boolean;
  version: number;
  error: string | null;
}

type RoleUpdateAction = (state: RoleUpdateState, formData: FormData) => Promise<RoleUpdateState>;

interface EditableMember {
  id: string;
  role: OrganizationRole;
  accountState: string;
  ministries: MemberMinistry[];
  profile: {
    displayName: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
    memberSince: string | null;
    birthday: string | null;
    anniversary: string | null;
    biography: string | null;
    familyNotes: string | null;
    photoUrl: string | null;
  };
  activeClaim: {
    id: string;
    status: 'PENDING' | 'REQUESTED';
  } | null;
  relationships?: Array<{
    id: string;
    type: 'SPOUSE' | 'PARENT' | 'CHILD' | 'SIBLING' | 'OTHER';
    fromMembershipId: string;
    toMembershipId: string;
    fromMembership: { id: string; profile: { displayName: string } | null };
    toMembership: { id: string; profile: { displayName: string } | null };
  }>;
}

type MemberRelationship = NonNullable<EditableMember['relationships']>[number];
type PendingRelationship = {
  relatedMembershipId: string;
  type: MemberRelationship['type'];
};
type CreateRelationshipAction = (
  formData: FormData,
) => Promise<{ ok: true; relationships: MemberRelationship[] } | { ok: false; error?: string }>;
type DeleteRelationshipAction = (formData: FormData) => Promise<{ ok: boolean; error?: string }>;

export type MemberProfileUpdate = Partial<EditableMember['profile']> & {
  ministries?: MemberMinistry[];
};

function MenuIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

export function EditMemberDialog({
  member,
  organizationId,
  action,
  memberCandidates,
  createRelationship,
  deleteRelationship,
  preparePhoto,
  confirmPhoto,
  onProfileUpdated,
  onRelationshipsChanged,
  dialogRef,
  onOpen,
  onClose,
  renderTrigger,
}: {
  member: EditableMember;
  organizationId: string;
  action: ProfileUpdateAction;
  memberCandidates: Array<{ id: string; displayName: string }>;
  createRelationship: CreateRelationshipAction;
  deleteRelationship: DeleteRelationshipAction;
  preparePhoto: PrepareMemberPhotoAction;
  confirmPhoto: ConfirmMemberPhotoAction;
  onProfileUpdated: (profile: MemberProfileUpdate) => void;
  onRelationshipsChanged?: ((relationships?: MemberRelationship[]) => void) | undefined;
  dialogRef: RefObject<HTMLDialogElement | null>;
  onOpen: () => void;
  onClose: () => void;
  renderTrigger?: ((openDialog: () => void) => ReactNode) | undefined;
}) {
  const t = useTranslations('members');
  const commonT = useTranslations('common');
  const titleId = useId();
  const [photo, setPhoto] = useState<File | null>(null);
  const [savedPhotoUrl, setSavedPhotoUrl] = useState(member.profile.photoUrl);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [relatedMembershipId, setRelatedMembershipId] = useState('');
  const [relationshipType, setRelationshipType] = useState<MemberRelationship['type']>('SPOUSE');
  const [relationships, setRelationships] = useState(member.relationships ?? []);
  const [pendingRelationshipCreates, setPendingRelationshipCreates] = useState<
    PendingRelationship[]
  >([]);
  const [pendingRelationshipDeleteIds, setPendingRelationshipDeleteIds] = useState<string[]>([]);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateOrganizationMemberProfileInput>({
    resolver: zodResolver(updateOrganizationMemberProfileSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      displayName: member.profile.displayName,
      email: member.profile.email,
      phone: member.profile.phone,
      notes: member.profile.notes,
      memberSince: member.profile.memberSince?.slice(0, 10) ?? null,
      birthday: member.profile.birthday?.slice(0, 10) ?? null,
      anniversary: member.profile.anniversary?.slice(0, 10) ?? null,
      biography: member.profile.biography,
      familyNotes: member.profile.familyNotes,
      ministries: member.ministries,
    },
  });
  const relationshipAlreadySelected = relatedMembershipId
    ? relationships.some((relationship) =>
        relationshipMatchesSelection(member.id, relationship, {
          relatedMembershipId,
          type: relationshipType,
        }),
      )
    : false;

  const submit = handleSubmit(async (values) => {
    const currentPhotoError = validateMemberPhoto(photo, {
      invalidType: t('chooseImageFile'),
      tooLarge: t('photoTooLarge'),
    });
    setPhotoError(currentPhotoError);
    if (currentPhotoError) return;

    let nextPhotoUrl = savedPhotoUrl;
    if (photo) {
      setUploading(true);
      try {
        const prepared = await preparePhoto({
          organizationId,
          membershipId: member.id,
          filename: photo.name,
          mimeType: photo.type,
          byteSize: photo.size,
        });
        if (!prepared.ok || !prepared.assetId || !prepared.uploadUrl) {
          throw new Error(prepared.error ?? t('unableToPreparePhotoUpload'));
        }
        const upload = await fetch(prepared.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': photo.type },
          body: photo,
        });
        if (!upload.ok) throw new Error(t('photoUploadFailed'));
        const confirmed = await confirmPhoto({
          organizationId,
          membershipId: member.id,
          assetId: prepared.assetId,
        });
        if (!confirmed.ok) throw new Error(confirmed.error ?? t('unableToConfirmPhoto'));
        nextPhotoUrl = confirmed.photoUrl ?? nextPhotoUrl;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('photoUploadFailed'));
        return;
      } finally {
        setUploading(false);
      }
    }

    const formData = new FormData();
    formData.set('organizationId', organizationId);
    formData.set('membershipId', member.id);
    for (const [key, value] of Object.entries(values)) {
      if (Array.isArray(value)) {
        value.forEach((item) => formData.append(key, item));
      } else {
        formData.set(key, value ?? '');
      }
    }
    const result = await action({ updated: false, error: null }, formData);
    if (result.error) toast.error(result.error);
    else {
      let savedRelationships = relationships;
      for (const relationshipId of pendingRelationshipDeleteIds) {
        const relationshipFormData = new FormData();
        relationshipFormData.set('organizationId', organizationId);
        relationshipFormData.set('relationshipId', relationshipId);
        const deleteResult = await deleteRelationship(relationshipFormData);
        if (!deleteResult.ok) {
          toast.error(deleteResult.error ?? t('unableToRemoveRelationship'));
          return;
        }
      }

      for (const relationship of pendingRelationshipCreates) {
        const relationshipFormData = new FormData();
        relationshipFormData.set('organizationId', organizationId);
        relationshipFormData.set('membershipId', member.id);
        relationshipFormData.set('relatedMembershipId', relationship.relatedMembershipId);
        relationshipFormData.set('relationshipType', relationship.type);
        const createResult = await createRelationship(relationshipFormData);
        if (!createResult.ok) {
          toast.error(createResult.error ?? t('unableToAddRelationship'));
          return;
        }
        savedRelationships = createResult.relationships;
      }

      toast.success(t('profileUpdated'));
      setSavedPhotoUrl(nextPhotoUrl);
      setPhoto(null);
      setRelationships(savedRelationships);
      setPendingRelationshipCreates([]);
      setPendingRelationshipDeleteIds([]);
      onProfileUpdated({
        ...(values.displayName !== undefined ? { displayName: values.displayName } : {}),
        ...(values.email !== undefined ? { email: values.email } : {}),
        ...(values.phone !== undefined ? { phone: values.phone } : {}),
        ...(values.notes !== undefined ? { notes: values.notes } : {}),
        ...(values.memberSince !== undefined ? { memberSince: values.memberSince } : {}),
        ...(values.birthday !== undefined ? { birthday: values.birthday } : {}),
        ...(values.anniversary !== undefined ? { anniversary: values.anniversary } : {}),
        ...(values.biography !== undefined ? { biography: values.biography } : {}),
        ...(values.familyNotes !== undefined ? { familyNotes: values.familyNotes } : {}),
        ...(values.ministries !== undefined ? { ministries: values.ministries } : {}),
        photoUrl: nextPhotoUrl,
      });
      onRelationshipsChanged?.(savedRelationships);
      dialogRef.current?.close();
    }
  });
  const resetRelationshipDraft = () => {
    setRelationships(member.relationships ?? []);
    setPendingRelationshipCreates([]);
    setPendingRelationshipDeleteIds([]);
    setRelatedMembershipId('');
    setRelationshipType('SPOUSE');
  };
  const openDialog = () => {
    resetRelationshipDraft();
    onOpen();
    dialogRef.current?.showModal();
  };

  return (
    <>
      {renderTrigger ? (
        renderTrigger(openDialog)
      ) : (
        <TableRowAction onClick={openDialog}>
          <MenuIcon>
            <path d="M4 20h4l11-11-4-4L4 16v4Zm9-13 4 4M13 5l2-2 4 4-2 2" />
          </MenuIcon>
          {t('editMember')}
        </TableRowAction>
      )}
      <dialog
        aria-labelledby={titleId}
        className="fixed inset-0 m-auto h-fit max-h-[min(800px,80dvh)] w-[min(560px,calc(100%-32px))] max-w-none overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[0_16px_48px_rgba(31,35,40,0.2)] backdrop:bg-[rgba(31,35,40,0.45)]"
        onClose={onClose}
        ref={dialogRef}
      >
        <form onSubmit={submit} className="flex max-h-[min(800px,80dvh)] flex-col" noValidate>
          <header className="flex items-start justify-between gap-4 border-b border-[var(--line-muted)] p-6 [&_h2]:m-0 [&_p]:m-0">
            <div>
              <p>{t('editProfile')}</p>
              <h2 id={titleId}>{member.profile.displayName}</h2>
            </div>
            <button
              aria-label={t('closeEditMemberPanel')}
              className="h-8 w-8 cursor-pointer rounded-[var(--radius)] border-0 bg-transparent text-2xl text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="membershipId" value={member.id} />
            <MemberPhotoField
              currentUrl={savedPhotoUrl}
              file={photo}
              error={photoError}
              onChange={(nextPhoto, nextError) => {
                setPhoto(nextPhoto);
                setPhotoError(nextError);
              }}
            />
            <FormInput
              label={commonT('name')}
              error={errors.displayName?.message}
              {...register('displayName')}
            />
            <FormInput
              label={commonT('email')}
              type="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <FormInput label={t('phone')} error={errors.phone?.message} {...register('phone')} />
            <FormTextarea
              label={t('notes')}
              rows={5}
              error={errors.notes?.message}
              {...register('notes')}
            />
            <FormDatePicker
              control={control}
              name="memberSince"
              label={t('memberSince')}
              error={errors.memberSince?.message}
            />
            <FormDatePicker
              control={control}
              name="birthday"
              label={t('birthday')}
              error={errors.birthday?.message}
            />
            <FormDatePicker
              control={control}
              name="anniversary"
              label={t('anniversary')}
              error={errors.anniversary?.message}
            />
            <FormTextarea
              label={t('biography')}
              rows={6}
              error={errors.biography?.message}
              {...register('biography')}
            />
            <FormTextarea
              label={t('familyNotes')}
              rows={4}
              error={errors.familyNotes?.message}
              {...register('familyNotes')}
            />
            <fieldset className="flex flex-col gap-2 rounded-md border border-[var(--line)] p-3">
              <legend className="px-1 font-semibold">{t('ministries')}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {MEMBER_MINISTRIES.map((ministry) => (
                  <FormCheckbox
                    key={ministry}
                    label={t(`ministry.${ministry}`)}
                    value={ministry}
                    {...register('ministries')}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-3 border-t border-[var(--line)] pt-4">
              <legend className="pr-2 font-semibold">{t('familyRelationships')}</legend>
              {relationships.map((relationship) => {
                const other =
                  relationship.fromMembershipId === member.id
                    ? relationship.toMembership
                    : relationship.fromMembership;
                return (
                  <div className="flex items-center justify-between gap-3" key={relationship.id}>
                    <span>
                      {other.profile?.displayName ?? t('member')} ·{' '}
                      {t(`relationshipLabels.${relationship.type}`)}
                    </span>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => {
                        const nextRelationships = relationships.filter(
                          ({ id }) => id !== relationship.id,
                        );
                        setRelationships(nextRelationships);
                        if (relationship.id.startsWith('draft:')) {
                          setPendingRelationshipCreates((current) =>
                            current.filter(
                              (pending) =>
                                !relationshipMatchesPending(member.id, relationship, pending),
                            ),
                          );
                          return;
                        }
                        setPendingRelationshipDeleteIds((current) =>
                          current.includes(relationship.id)
                            ? current
                            : [...current, relationship.id],
                        );
                      }}
                    >
                      {t('remove')}
                    </button>
                    <input type="hidden" name="organizationId" value={organizationId} />
                  </div>
                );
              })}
              <div className="grid gap-2 sm:grid-cols-2">
                <FormSelect
                  label={t('relatedMember')}
                  value={relatedMembershipId}
                  onChange={(event) => setRelatedMembershipId(event.target.value)}
                >
                  <option value="">{t('selectMember')}</option>
                  {memberCandidates
                    .filter((candidate) => candidate.id !== member.id)
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.displayName}
                      </option>
                    ))}
                </FormSelect>
                <FormSelect
                  label={t('relationship')}
                  value={relationshipType}
                  onChange={(event) =>
                    setRelationshipType(event.target.value as MemberRelationship['type'])
                  }
                >
                  <option value="SPOUSE">{t('relationshipLabels.SPOUSE')}</option>
                  <option value="PARENT">{t('relationshipLabels.PARENT')}</option>
                  <option value="CHILD">{t('relationshipLabels.CHILD')}</option>
                  <option value="SIBLING">{t('relationshipLabels.SIBLING')}</option>
                  <option value="OTHER">{t('relationshipLabels.OTHER')}</option>
                </FormSelect>
              </div>
              <button
                className="button secondary"
                type="button"
                disabled={!relatedMembershipId || relationshipAlreadySelected}
                onClick={() => {
                  const relatedMember = memberCandidates.find(
                    ({ id }) => id === relatedMembershipId,
                  );
                  if (!relatedMember) return;

                  const pendingRelationship = {
                    relatedMembershipId,
                    type: relationshipType,
                  };
                  const draftRelationship = createDraftRelationship({
                    currentMemberId: member.id,
                    currentMemberName: member.profile.displayName,
                    relatedMemberId: relatedMembershipId,
                    relatedMemberName: relatedMember.displayName,
                    type: relationshipType,
                  });

                  setRelationships((current) => [...current, draftRelationship]);
                  setPendingRelationshipCreates((current) => [...current, pendingRelationship]);
                  setPendingRelationshipDeleteIds((current) =>
                    current.filter((relationshipId) => relationshipId !== draftRelationship.id),
                  );
                  setRelatedMembershipId('');
                }}
              >
                {t('addRelationship')}
              </button>
            </fieldset>
          </div>
          <footer className="flex justify-end gap-2 border-t border-[var(--line-muted)] bg-[var(--surface)] px-6 py-4">
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
              {commonT('cancel')}
            </Button>
            <Button disabled={isSubmitting || uploading} type="submit">
              {uploading ? t('uploading') : isSubmitting ? commonT('saving') : t('saveChanges')}
            </Button>
          </footer>
        </form>
      </dialog>
    </>
  );
}

function normalizeRelationship(input: {
  currentMemberId: string;
  relatedMemberId: string;
  type: MemberRelationship['type'];
}) {
  let fromMembershipId = input.currentMemberId;
  let toMembershipId = input.relatedMemberId;
  let type = input.type;

  if (type === 'CHILD') {
    fromMembershipId = input.relatedMemberId;
    toMembershipId = input.currentMemberId;
    type = 'PARENT';
  }

  if (type !== 'PARENT' && fromMembershipId > toMembershipId) {
    [fromMembershipId, toMembershipId] = [toMembershipId, fromMembershipId];
  }

  return { fromMembershipId, toMembershipId, type };
}

function createDraftRelationship({
  currentMemberId,
  currentMemberName,
  relatedMemberId,
  relatedMemberName,
  type,
}: {
  currentMemberId: string;
  currentMemberName: string;
  relatedMemberId: string;
  relatedMemberName: string;
  type: MemberRelationship['type'];
}): MemberRelationship {
  const normalized = normalizeRelationship({ currentMemberId, relatedMemberId, type });

  return {
    id: `draft:${normalized.fromMembershipId}:${normalized.toMembershipId}:${normalized.type}`,
    type: normalized.type,
    fromMembershipId: normalized.fromMembershipId,
    toMembershipId: normalized.toMembershipId,
    fromMembership: {
      id: normalized.fromMembershipId,
      profile: {
        displayName:
          normalized.fromMembershipId === currentMemberId ? currentMemberName : relatedMemberName,
      },
    },
    toMembership: {
      id: normalized.toMembershipId,
      profile: {
        displayName:
          normalized.toMembershipId === currentMemberId ? currentMemberName : relatedMemberName,
      },
    },
  };
}

function relationshipMatchesSelection(
  currentMemberId: string,
  relationship: MemberRelationship,
  selection: PendingRelationship,
) {
  const normalized = normalizeRelationship({
    currentMemberId,
    relatedMemberId: selection.relatedMembershipId,
    type: selection.type,
  });

  return (
    relationship.fromMembershipId === normalized.fromMembershipId &&
    relationship.toMembershipId === normalized.toMembershipId &&
    relationship.type === normalized.type
  );
}

function relationshipMatchesPending(
  currentMemberId: string,
  relationship: MemberRelationship,
  pendingRelationship: PendingRelationship,
) {
  return relationshipMatchesSelection(currentMemberId, relationship, pendingRelationship);
}

function ChangeRoleDialog({
  member,
  organizationId,
  action,
  onRoleUpdated,
  dialogRef,
  onOpen,
  onClose,
}: {
  member: EditableMember;
  organizationId: string;
  action: RoleUpdateAction;
  onRoleUpdated: (role: OrganizationRole) => void;
  dialogRef: RefObject<HTMLDialogElement | null>;
  onOpen: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('members');
  const commonT = useTranslations('common');
  const titleId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const result = await action(
      { role: member.role, updated: false, version: 0, error: null },
      formData,
    );
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onRoleUpdated(result.role);
    dialogRef.current?.close();
  }

  return (
    <>
      <TableRowAction
        onClick={() => {
          onOpen();
          dialogRef.current?.showModal();
        }}
      >
        <MenuIcon>
          <path d="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M18 8h4m-2-2v4" />
        </MenuIcon>
        {t('changeRole')}
      </TableRowAction>
      <dialog
        aria-labelledby={titleId}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[min(480px,calc(100%-32px))] max-w-none rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[0_16px_48px_rgba(31,35,40,0.2)] backdrop:bg-[rgba(31,35,40,0.45)] backdrop:backdrop-blur-[1px]"
        onClose={onClose}
        ref={dialogRef}
      >
        <form onSubmit={submit} className="grid gap-6 p-6">
          <div className="grid gap-2 [&_h2]:m-0 [&_h2]:text-xl [&_p]:m-0 [&_p]:text-[var(--muted)]">
            <h2 id={titleId}>{t('changeRoleTitle')}</h2>
            <p>{t('changeRoleDescription', { name: member.profile.displayName })}</p>
          </div>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="membershipId" value={member.id} />
          {error ? <p className="form-error m-0">{error}</p> : null}
          <FormSelect label={t('role')} name="role" defaultValue={member.role}>
            {member.accountState === 'CLAIMED' ? (
              <>
                <option value="OWNER">{t('roleLabels.OWNER')}</option>
                <option value="ADMIN">{t('roleLabels.ADMIN')}</option>
              </>
            ) : null}
            <option value="MEMBER">{t('roleLabels.MEMBER')}</option>
            <option value="VIEWER">{t('roleLabels.VIEWER')}</option>
          </FormSelect>
          <div className="flex flex-col-reverse items-stretch justify-end gap-2 md:flex-row md:items-center">
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
              {commonT('cancel')}
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? t('updating') : t('updateRole')}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function MemberRoleStatus({ role }: { role: OrganizationRole }) {
  const t = useTranslations('members');

  return <LocalizedStatusBadge status={role} label={t(`roleLabels.${role}`)} />;
}

function GiveMemberAccessAction({
  accessDialogRef,
  member,
  organizationId,
  setOpenDialog,
}: {
  accessDialogRef: RefObject<HTMLDialogElement | null>;
  member: EditableMember;
  organizationId: string;
  setOpenDialog: (dialog: 'access' | null) => void;
}) {
  return (
    <GiveMemberAccessDialog
      dialogRef={accessDialogRef}
      onOpen={() => {
        setOpenDialog('access');
      }}
      onClose={() => setOpenDialog(null)}
      memberEmail={member.profile.email}
      memberName={member.profile.displayName}
      membershipId={member.id}
      organizationId={organizationId}
      triggerClassName={tableRowActionClassNameFor()}
    />
  );
}

export function MemberActions({
  member,
  organizationId,
  canManage,
  isOwner,
  isCurrentMember,
  updateProfile,
  updateRole,
  removeMember,
  claimAction,
  memberCandidates,
  viewHref,
  createRelationship,
  deleteRelationship,
  preparePhoto,
  confirmPhoto,
  onProfileUpdated,
  onRelationshipsChanged,
  onRoleUpdated,
  onRemoved,
}: {
  member: EditableMember;
  organizationId: string;
  canManage: boolean;
  isOwner: boolean;
  isCurrentMember: boolean;
  updateProfile: ProfileUpdateAction;
  updateRole: RoleUpdateAction;
  removeMember: RemoveMemberAction;
  claimAction: FormAction;
  memberCandidates: Array<{ id: string; displayName: string }>;
  viewHref?: Route | undefined;
  createRelationship: CreateRelationshipAction;
  deleteRelationship: DeleteRelationshipAction;
  preparePhoto: PrepareMemberPhotoAction;
  confirmPhoto: ConfirmMemberPhotoAction;
  onProfileUpdated: (profile: MemberProfileUpdate) => void;
  onRelationshipsChanged?: ((relationships?: MemberRelationship[]) => void) | undefined;
  onRoleUpdated: (role: OrganizationRole) => void;
  onRemoved: () => void;
}) {
  const t = useTranslations('members');
  const commonT = useTranslations('common');
  const router = useRouter();
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const roleDialogRef = useRef<HTMLDialogElement>(null);
  const accessDialogRef = useRef<HTMLDialogElement>(null);
  const [openDialog, setOpenDialog] = useState<'edit' | 'role' | 'access' | null>(null);

  if (!canManage && !isOwner && !viewHref) return null;

  return (
    <TableRowActions
      ignoreOutsideClickRefs={[
        editDialogRef as RefObject<Element | null>,
        roleDialogRef as RefObject<Element | null>,
        accessDialogRef as RefObject<Element | null>,
      ]}
      label={t('actionsFor', { name: member.profile.displayName })}
      outsideClickDisabled={openDialog !== null}
    >
      {viewHref ? (
        <TableRowAction onSelect={() => router.push(viewHref)}>
          <MenuIcon>
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
            <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
          </MenuIcon>
          {t('viewMember')}
        </TableRowAction>
      ) : null}
      {canManage ? (
        <EditMemberDialog
          member={member}
          organizationId={organizationId}
          action={updateProfile}
          memberCandidates={memberCandidates}
          createRelationship={createRelationship}
          deleteRelationship={deleteRelationship}
          preparePhoto={preparePhoto}
          confirmPhoto={confirmPhoto}
          onProfileUpdated={onProfileUpdated}
          onRelationshipsChanged={onRelationshipsChanged}
          dialogRef={editDialogRef}
          onOpen={() => setOpenDialog('edit')}
          onClose={() => setOpenDialog(null)}
        />
      ) : null}
      {isOwner ? (
        <ChangeRoleDialog
          member={member}
          organizationId={organizationId}
          action={updateRole}
          onRoleUpdated={onRoleUpdated}
          dialogRef={roleDialogRef}
          onOpen={() => setOpenDialog('role')}
          onClose={() => setOpenDialog(null)}
        />
      ) : null}
      {canManage && member.accountState === 'UNCLAIMED' ? (
        <GiveMemberAccessAction
          accessDialogRef={accessDialogRef}
          member={member}
          organizationId={organizationId}
          setOpenDialog={setOpenDialog}
        />
      ) : null}
      {canManage && member.activeClaim ? (
        <form className="contents" action={claimAction}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="claimId" value={member.activeClaim.id} />
          {member.activeClaim.status === 'REQUESTED' ? (
            <>
              <button
                className={tableRowActionClassNameFor()}
                name="action"
                value="approve"
                type="submit"
              >
                {t('approveAccess')}
              </button>
              <button
                className={tableRowActionClassNameFor({ destructive: true })}
                name="action"
                value="reject"
                type="submit"
              >
                {t('rejectRequest')}
              </button>
            </>
          ) : (
            <button
              className={tableRowActionClassNameFor()}
              name="action"
              value="refresh"
              type="submit"
            >
              {t('refreshAccessLink')}
            </button>
          )}
          <button
            className={tableRowActionClassNameFor({ destructive: true })}
            name="action"
            value="revoke"
            type="submit"
          >
            {t('revokeAccessLink')}
          </button>
        </form>
      ) : null}
      {isOwner && !isCurrentMember ? (
        <form
          className="contents"
          action={async (formData) => {
            const result = await removeMember(formData);
            if (result.ok) {
              toast.success(t('removedMember'));
              onRemoved();
              return;
            }

            toast.error(result.error ?? t('unableToRemoveMember'));
          }}
        >
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="membershipId" value={member.id} />
          <ConfirmSubmitButton
            cancelLabel={commonT('cancel')}
            confirmLabel={t('removeMember')}
            confirmVariant="danger"
            description={t('removeMemberDescription', { name: member.profile.displayName })}
            pendingLabel={t('confirming')}
            title={t('removeMemberTitle')}
            triggerClassName={tableRowActionClassNameFor({ destructive: true })}
            triggerLabel={t('removeMember')}
            variant="ghost"
          />
        </form>
      ) : null}
    </TableRowActions>
  );
}

function LocalizedStatusBadge({ status, label }: { status: string; label: string }) {
  const normalized = status.toLowerCase().replaceAll('_', '-');
  return <span className={`status-badge status-${normalized}`}>{label}</span>;
}
