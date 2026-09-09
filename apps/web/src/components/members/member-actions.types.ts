import type { Route } from 'next';
import type { ReactNode, RefObject } from 'react';
import type { OrganizationGroupBadge } from '@churchflow/shared';
import type { MemberActiveClaim } from './member-access.types';

export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type OrganizationMemberStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | 'REMOVED';
export type FormAction = (formData: FormData) => void | Promise<void>;
export type MemberLifecycleAction = (
  formData: FormData,
) => Promise<{ ok: boolean; error?: string }>;

export interface ProfileUpdateState {
  updated: boolean;
  error: string | null;
}

export type ProfileUpdateAction = (
  state: ProfileUpdateState,
  formData: FormData,
) => Promise<ProfileUpdateState>;

export type PrepareMemberPhotoAction = (input: {
  organizationId: string;
  membershipId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
}) => Promise<{ ok: boolean; error?: string; assetId?: string; uploadUrl?: string }>;

export type ConfirmMemberPhotoAction = (input: {
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

export type RoleUpdateAction = (
  state: RoleUpdateState,
  formData: FormData,
) => Promise<RoleUpdateState>;

export interface EditableMember {
  id: string;
  role: OrganizationRole;
  status: OrganizationMemberStatus;
  accountState: string;
  groups: OrganizationGroupBadge[];
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
  activeClaim: MemberActiveClaim | null;
  relationships?: Array<{
    id: string;
    type: 'SPOUSE' | 'PARENT' | 'CHILD' | 'SIBLING' | 'OTHER';
    fromMembershipId: string;
    toMembershipId: string;
    fromMembership: { id: string; profile: { displayName: string } | null };
    toMembership: { id: string; profile: { displayName: string } | null };
  }>;
}

export type MemberRelationship = NonNullable<EditableMember['relationships']>[number];

export type PendingRelationship = {
  relatedMembershipId: string;
  type: MemberRelationship['type'];
};

export type CreateRelationshipAction = (
  formData: FormData,
) => Promise<{ ok: true; relationships: MemberRelationship[] } | { ok: false; error?: string }>;

export type DeleteRelationshipAction = (
  formData: FormData,
) => Promise<{ ok: boolean; error?: string }>;

export type MemberProfileUpdate = Partial<EditableMember['profile']> & {
  groups?: string[];
};

export interface EditMemberDialogProps {
  member: EditableMember;
  organizationId: string;
  action: ProfileUpdateAction;
  groupOptions: OrganizationGroupBadge[];
  memberCandidates: Array<{ id: string; displayName: string }>;
  createRelationship: CreateRelationshipAction;
  deleteRelationship: DeleteRelationshipAction;
  preparePhoto: PrepareMemberPhotoAction;
  confirmPhoto: ConfirmMemberPhotoAction;
  onProfileUpdated: (profile: MemberProfileUpdate) => void;
  onRelationshipsChanged?: ((relationships?: MemberRelationship[]) => void) | undefined;
  canManageRelationships: boolean;
  dialogRef: RefObject<HTMLDialogElement | null>;
  onOpen: () => void;
  onClose: () => void;
  renderTrigger?: ((openDialog: () => void) => ReactNode) | undefined;
}

export interface ChangeRoleDialogProps {
  member: EditableMember;
  organizationId: string;
  action: RoleUpdateAction;
  onRoleUpdated: (role: OrganizationRole) => void;
  dialogRef: RefObject<HTMLDialogElement | null>;
  onOpen: () => void;
  onClose: () => void;
}

export interface GiveMemberAccessActionProps {
  accessDialogRef: RefObject<HTMLDialogElement | null>;
  member: EditableMember;
  organizationId: string;
  setOpenDialog: (dialog: 'access' | null) => void;
}

export interface MemberActionsProps {
  member: EditableMember;
  organizationId: string;
  canManage: boolean;
  isOwner: boolean;
  isCurrentMember: boolean;
  updateProfile: ProfileUpdateAction;
  updateRole: RoleUpdateAction;
  archiveMember: MemberLifecycleAction;
  removeMember: MemberLifecycleAction;
  restoreMember: MemberLifecycleAction;
  claimAction: FormAction;
  groupOptions: OrganizationGroupBadge[];
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
}

export interface MemberLifecycleActionFormProps {
  action: MemberLifecycleAction;
  children: ReactNode;
  fallbackErrorLabel: string;
  member: EditableMember;
  organizationId: string;
  onSuccess: () => void;
  successLabel: string;
}
