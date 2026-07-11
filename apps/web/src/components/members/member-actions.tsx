'use client';

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCloseOnOutsideClick } from '@/hooks/use-close-on-outside-click';
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
type RelationshipAction = (formData: FormData) => Promise<{ ok: boolean; error?: string }>;

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

const actionItemClassName =
  'flex min-h-[38px] w-full cursor-pointer items-center justify-start gap-2.5 rounded-md border-0 bg-transparent px-2.5 py-2 text-left font-medium text-[var(--foreground)] shadow-none hover:bg-[var(--surface-subtle)]';

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

type MemberProfileUpdate = Partial<EditableMember['profile']> & {
  ministries?: MemberMinistry[];
};

const MINISTRY_LABELS: Record<MemberMinistry, string> = {
  PREACHING: 'Preaching',
  WORSHIP: 'Worship',
  DEACON: 'Deacon',
  MINISTER: 'Minister',
  TEACHER: 'Teacher',
  MISSIONARY: 'Missionary',
  EVANGELIST: 'Evangelist',
  CHAPLAIN: 'Chaplain',
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

function EditMemberSheet({
  member,
  organizationId,
  action,
  memberCandidates,
  createRelationship,
  deleteRelationship,
  preparePhoto,
  confirmPhoto,
  onProfileUpdated,
  dialogRef,
  onOpen,
  onClose,
}: {
  member: EditableMember;
  organizationId: string;
  action: ProfileUpdateAction;
  memberCandidates: Array<{ id: string; displayName: string }>;
  createRelationship: RelationshipAction;
  deleteRelationship: RelationshipAction;
  preparePhoto: PrepareMemberPhotoAction;
  confirmPhoto: ConfirmMemberPhotoAction;
  onProfileUpdated: (profile: MemberProfileUpdate) => void;
  dialogRef: RefObject<HTMLDialogElement | null>;
  onOpen: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const [photo, setPhoto] = useState<File | null>(null);
  const [savedPhotoUrl, setSavedPhotoUrl] = useState(member.profile.photoUrl);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [relatedMembershipId, setRelatedMembershipId] = useState('');
  const [relationshipType, setRelationshipType] = useState('SPOUSE');
  const [relationships, setRelationships] = useState(member.relationships ?? []);
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

  const submit = handleSubmit(async (values) => {
    const currentPhotoError = validateMemberPhoto(photo);
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
          throw new Error(prepared.error ?? 'Unable to prepare photo upload.');
        }
        const upload = await fetch(prepared.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': photo.type },
          body: photo,
        });
        if (!upload.ok) throw new Error('Photo upload failed.');
        const confirmed = await confirmPhoto({
          organizationId,
          membershipId: member.id,
          assetId: prepared.assetId,
        });
        if (!confirmed.ok) throw new Error(confirmed.error ?? 'Unable to confirm photo.');
        nextPhotoUrl = confirmed.photoUrl ?? nextPhotoUrl;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Photo upload failed.');
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
      toast.success('Member profile updated.');
      setSavedPhotoUrl(nextPhotoUrl);
      setPhoto(null);
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
    }
  });

  return (
    <>
      <button
        className={actionItemClassName}
        type="button"
        onClick={() => {
          onOpen();
          dialogRef.current?.showModal();
        }}
      >
        <MenuIcon>
          <path d="M4 20h4l11-11-4-4L4 16v4Zm9-13 4 4M13 5l2-2 4 4-2 2" />
        </MenuIcon>
        Edit member
      </button>
      <dialog
        aria-labelledby={titleId}
        className="fixed left-1/2 top-1/2 h-fit max-h-[min(800px,80dvh)] w-[min(560px,calc(100%-32px))] max-w-none -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[0_16px_48px_rgba(31,35,40,0.2)] backdrop:bg-[rgba(31,35,40,0.45)]"
        onClose={onClose}
        ref={dialogRef}
      >
        <form
          onSubmit={submit}
          className="grid max-h-[min(800px,80dvh)] grid-rows-[auto_minmax(0,1fr)_auto]"
          noValidate
        >
          <header className="flex items-start justify-between gap-4 border-b border-[var(--line-muted)] p-6 [&_h2]:m-0 [&_p]:m-0">
            <div>
              <p>Edit profile</p>
              <h2 id={titleId}>{member.profile.displayName}</h2>
            </div>
            <button
              aria-label="Close edit member panel"
              className="h-8 w-8 cursor-pointer rounded-[var(--radius)] border-0 bg-transparent text-2xl text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </header>
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-6">
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
              label="Name"
              error={errors.displayName?.message}
              {...register('displayName')}
            />
            <FormInput
              label="Email"
              type="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <FormInput label="Phone" error={errors.phone?.message} {...register('phone')} />
            <FormTextarea
              label="Notes"
              rows={5}
              error={errors.notes?.message}
              {...register('notes')}
            />
            <FormDatePicker
              control={control}
              name="memberSince"
              label="Member since"
              error={errors.memberSince?.message}
            />
            <FormDatePicker
              control={control}
              name="birthday"
              label="Birthday"
              error={errors.birthday?.message}
            />
            <FormDatePicker
              control={control}
              name="anniversary"
              label="Anniversary"
              error={errors.anniversary?.message}
            />
            <FormTextarea
              label="Biography"
              rows={6}
              error={errors.biography?.message}
              {...register('biography')}
            />
            <FormTextarea
              label="Family notes"
              rows={4}
              error={errors.familyNotes?.message}
              {...register('familyNotes')}
            />
            <fieldset className="grid gap-2 rounded-md border border-[var(--line)] p-3">
              <legend className="px-1 font-semibold">Ministries</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {MEMBER_MINISTRIES.map((ministry) => (
                  <FormCheckbox
                    key={ministry}
                    label={MINISTRY_LABELS[ministry]}
                    value={ministry}
                    {...register('ministries')}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="grid gap-3 border-t border-[var(--line)] pt-4">
              <legend className="font-semibold pr-2">Family relationships</legend>
              {relationships.map((relationship) => {
                const other =
                  relationship.fromMembershipId === member.id
                    ? relationship.toMembership
                    : relationship.fromMembership;
                return (
                  <div className="flex items-center justify-between gap-3" key={relationship.id}>
                    <span>
                      {other.profile?.displayName ?? 'Member'} · {relationship.type.toLowerCase()}
                    </span>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={async () => {
                        const data = new FormData();
                        data.set('organizationId', organizationId);
                        data.set('relationshipId', relationship.id);
                        const result = await deleteRelationship(data);
                        if (result.ok) {
                          setRelationships((current) =>
                            current.filter(({ id }) => id !== relationship.id),
                          );
                          toast.success('Relationship removed.');
                        } else toast.error(result.error ?? 'Unable to remove relationship.');
                      }}
                    >
                      Remove
                    </button>
                    <input type="hidden" name="organizationId" value={organizationId} />
                  </div>
                );
              })}
              <div className="grid grid-cols-2 gap-2">
                <FormSelect
                  label="Related member"
                  value={relatedMembershipId}
                  onChange={(event) => setRelatedMembershipId(event.target.value)}
                >
                  <option value="">Select member</option>
                  {memberCandidates
                    .filter((candidate) => candidate.id !== member.id)
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.displayName}
                      </option>
                    ))}
                </FormSelect>
                <FormSelect
                  label="Relationship"
                  value={relationshipType}
                  onChange={(event) => setRelationshipType(event.target.value)}
                >
                  <option value="SPOUSE">Spouse</option>
                  <option value="PARENT">Parent</option>
                  <option value="CHILD">Child</option>
                  <option value="SIBLING">Sibling</option>
                  <option value="OTHER">Other</option>
                </FormSelect>
              </div>
              <button
                className="button secondary"
                type="button"
                disabled={!relatedMembershipId}
                onClick={async () => {
                  const data = new FormData();
                  data.set('organizationId', organizationId);
                  data.set('membershipId', member.id);
                  data.set('relatedMembershipId', relatedMembershipId);
                  data.set('relationshipType', relationshipType);
                  const result = await createRelationship(data);
                  if (result.ok) {
                    toast.success('Relationship added.');
                    setRelatedMembershipId('');
                  } else toast.error(result.error ?? 'Unable to add relationship.');
                }}
              >
                Add relationship
              </button>
            </fieldset>
          </div>
          <footer className="flex justify-end gap-2 border-t border-[var(--line-muted)] bg-[var(--surface)] px-6 py-4">
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
            <Button disabled={isSubmitting || uploading} type="submit">
              {uploading ? 'Uploading…' : isSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
          </footer>
        </form>
      </dialog>
    </>
  );
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
      <button
        className={actionItemClassName}
        type="button"
        onClick={() => {
          onOpen();
          dialogRef.current?.showModal();
        }}
      >
        <MenuIcon>
          <path d="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M18 8h4m-2-2v4" />
        </MenuIcon>
        Change role
      </button>
      <dialog
        aria-labelledby={titleId}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[min(480px,calc(100%-32px))] max-w-none rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[0_16px_48px_rgba(31,35,40,0.2)] backdrop:bg-[rgba(31,35,40,0.45)] backdrop:backdrop-blur-[1px]"
        onClose={onClose}
        ref={dialogRef}
      >
        <form onSubmit={submit} className="grid gap-6 p-6">
          <div className="grid gap-2 [&_h2]:m-0 [&_h2]:text-xl [&_p]:m-0 [&_p]:text-[var(--muted)]">
            <h2 id={titleId}>Change member role</h2>
            <p>Choose the organization access level for {member.profile.displayName}.</p>
          </div>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="membershipId" value={member.id} />
          {error ? <p className="form-error m-0">{error}</p> : null}
          <FormSelect label="Role" name="role" defaultValue={member.role}>
            {member.accountState === 'CLAIMED' ? (
              <>
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Admin</option>
              </>
            ) : null}
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </FormSelect>
          <div className="flex flex-col-reverse items-stretch justify-end gap-2 md:flex-row md:items-center">
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? 'Updating…' : 'Update role'}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function MemberRoleStatus({ role }: { role: OrganizationRole }) {
  return <StatusBadge status={role} />;
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
  createRelationship,
  deleteRelationship,
  preparePhoto,
  confirmPhoto,
  onProfileUpdated,
  onRoleUpdated,
}: {
  member: EditableMember;
  organizationId: string;
  canManage: boolean;
  isOwner: boolean;
  isCurrentMember: boolean;
  updateProfile: ProfileUpdateAction;
  updateRole: RoleUpdateAction;
  removeMember: FormAction;
  claimAction: FormAction;
  memberCandidates: Array<{ id: string; displayName: string }>;
  createRelationship: RelationshipAction;
  deleteRelationship: RelationshipAction;
  preparePhoto: PrepareMemberPhotoAction;
  confirmPhoto: ConfirmMemberPhotoAction;
  onProfileUpdated: (profile: MemberProfileUpdate) => void;
  onRoleUpdated: (role: OrganizationRole) => void;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const menuContentRef = useRef<HTMLDivElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const roleDialogRef = useRef<HTMLDialogElement>(null);
  const accessDialogRef = useRef<HTMLDialogElement>(null);
  const [openDialog, setOpenDialog] = useState<'edit' | 'role' | 'access' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });

  useLayoutEffect(() => {
    if (!menuOpen) return;

    const updateMenuPosition = () => {
      const trigger = menuRef.current?.querySelector('summary');
      if (!trigger) return;

      const triggerRect = trigger.getBoundingClientRect();
      const menuHeight = menuContentRef.current?.offsetHeight ?? 0;
      const preferredTop = triggerRect.bottom + 6;
      const maxTop = window.innerHeight - menuHeight - 8;

      setMenuPosition({
        top: Math.max(8, Math.min(preferredTop, maxTop)),
        right: Math.max(8, window.innerWidth - triggerRect.right),
      });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [menuOpen]);

  useCloseOnOutsideClick({
    refs: [
      menuRef as RefObject<Element | null>,
      editDialogRef as RefObject<Element | null>,
      roleDialogRef as RefObject<Element | null>,
      accessDialogRef as RefObject<Element | null>,
    ],
    onOutsideClick: () => {
      if (menuRef.current) {
        menuRef.current.open = false;
      }
    },
    enabled: openDialog === null,
  });

  if (!canManage && !isOwner) return null;

  return (
    <details
      className="group relative col-start-2 row-start-1 row-end-[span_4] self-start justify-self-end md:col-auto md:row-auto md:self-auto"
      onToggle={(event) => setMenuOpen(event.currentTarget.open)}
      ref={menuRef}
    >
      <summary
        className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-[var(--radius)] border border-transparent text-[var(--foreground)] hover:border-[var(--line)] hover:bg-[var(--surface-subtle)] group-open:border-[var(--accent)] group-open:bg-[var(--surface-subtle)] group-open:ring-2 group-open:ring-[rgba(9,105,218,0.15)] [&::-webkit-details-marker]:hidden"
        aria-label={`Actions for ${member.profile.displayName}`}
      >
        <svg aria-hidden="true" className="h-5 w-5 fill-current" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="10" cy="16" r="1.6" />
        </svg>
      </summary>
      <div
        className="fixed z-50 w-[220px] overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_12px_32px_rgba(31,35,40,0.16)]"
        ref={menuContentRef}
        style={{ top: menuPosition.top, right: menuPosition.right }}
      >
        {canManage ? (
          <EditMemberSheet
            member={member}
            organizationId={organizationId}
            action={updateProfile}
            memberCandidates={memberCandidates}
            createRelationship={createRelationship}
            deleteRelationship={deleteRelationship}
            preparePhoto={preparePhoto}
            confirmPhoto={confirmPhoto}
            onProfileUpdated={onProfileUpdated}
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
          <GiveMemberAccessDialog
            dialogRef={accessDialogRef}
            onOpen={() => setOpenDialog('access')}
            onClose={() => setOpenDialog(null)}
            memberEmail={member.profile.email}
            memberName={member.profile.displayName}
            membershipId={member.id}
            organizationId={organizationId}
            triggerClassName={actionItemClassName}
          />
        ) : null}
        {canManage && member.activeClaim ? (
          <form className="contents" action={claimAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="claimId" value={member.activeClaim.id} />
            {member.activeClaim.status === 'REQUESTED' ? (
              <>
                <button className={actionItemClassName} name="action" value="approve" type="submit">
                  Approve access
                </button>
                <button
                  className={`${actionItemClassName} !text-[var(--danger)]`}
                  name="action"
                  value="reject"
                  type="submit"
                >
                  Reject request
                </button>
              </>
            ) : (
              <button className={actionItemClassName} name="action" value="refresh" type="submit">
                Refresh access link
              </button>
            )}
            <button
              className={`${actionItemClassName} !text-[var(--danger)]`}
              name="action"
              value="revoke"
              type="submit"
            >
              Revoke access link
            </button>
          </form>
        ) : null}
        {isOwner && !isCurrentMember ? (
          <form className="contents" action={removeMember}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="membershipId" value={member.id} />
            <ConfirmSubmitButton
              confirmLabel="Remove member"
              confirmVariant="danger"
              description={`Remove ${member.profile.displayName} from this organization.`}
              title="Remove member?"
              triggerClassName={`${actionItemClassName} !text-[var(--danger)]`}
              triggerLabel="Remove member"
              variant="ghost"
            />
          </form>
        ) : null}
      </div>
    </details>
  );
}
