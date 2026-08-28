import type { RefObject } from 'react';

export interface MemberAccessActionState {
  claimId: string | null;
  claimUrl: string | null;
  expiresAt: string | null;
  message: string | null;
  error: string | null;
}

export interface MemberActiveClaim {
  id: string;
  status: 'PENDING' | 'REQUESTED';
  expiresAt: string;
}

export interface GiveMemberAccessDialogProps {
  organizationId: string;
  membershipId: string;
  memberName: string;
  memberEmail: string | null;
  activeClaim: MemberActiveClaim | null;
  triggerClassName: string;
  dialogRef?: RefObject<HTMLDialogElement | null>;
  onOpen?: () => void;
  onClose?: () => void;
}
