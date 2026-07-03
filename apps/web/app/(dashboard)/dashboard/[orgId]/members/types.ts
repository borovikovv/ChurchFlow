export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type AccountState =
  | 'UNCLAIMED'
  | 'CLAIM_PENDING'
  | 'CLAIM_REQUESTED'
  | 'CLAIMED'
  | 'ACCOUNT_DISABLED';

export interface MemberRelationship {
  id: string;
  type: 'SPOUSE' | 'PARENT' | 'CHILD' | 'SIBLING' | 'OTHER';
  fromMembershipId: string;
  toMembershipId: string;
  fromMembership: { id: string; profile: { displayName: string } | null };
  toMembership: { id: string; profile: { displayName: string } | null };
}

export interface OrganizationMember {
  id: string;
  role: OrganizationRole;
  status: string;
  source: string;
  accountState: AccountState;
  claimedAt: string | null;
  profile: {
    displayName: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
    memberSince: string | null;
    biography: string | null;
    familyNotes: string | null;
    profilePhotoAssetId: string | null;
    photoUrl: string | null;
  };
  user: { id: string; email: string | null; displayName: string | null } | null;
  activeClaim: {
    id: string;
    status: 'PENDING' | 'REQUESTED';
    expiresAt: string;
    requestedBy: { id: string; displayName: string | null; avatarUrl: string | null } | null;
  } | null;
  relationships?: MemberRelationship[];
}

export interface PendingInvitation {
  id: string;
  mode: string;
  targetDisplay: string | null;
  email: string | null;
  role: string;
  expiresAt: string;
}

export interface MembersPayload {
  actorRole: OrganizationRole | null;
  actorMembershipId: string | null;
  members: OrganizationMember[];
  pendingInvitations: PendingInvitation[];
}

export interface InvitationMutationResult {
  invitation: PendingInvitation;
  acceptUrl: string;
  emailSent: boolean;
}

export interface ClaimMutationResult {
  claim: { id: string };
  claimUrl: string;
  emailSent: boolean;
}
