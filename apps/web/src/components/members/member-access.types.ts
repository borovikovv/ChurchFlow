export interface MemberAccessActionState {
  claimId: string | null;
  claimUrl: string | null;
  message: string | null;
  error: string | null;
}

export interface GiveMemberAccessDialogProps {
  organizationId: string;
  membershipId: string;
  memberName: string;
  memberEmail: string | null;
  triggerClassName: string;
}
