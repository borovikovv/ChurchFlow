import type { OrganizationRequestStatusItem } from '@churchflow/shared';
import type { RefObject } from 'react';

export interface OrganizationRequestActionsProps {
  request: OrganizationRequestStatusItem;
  hasPendingRequest: boolean;
  onResubmitted: (request: OrganizationRequestStatusItem) => void;
  onDeleted: (requestId: string) => void;
}

export interface LifecycleConfirmationDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  error: string | null;
  destructive?: boolean;
  onConfirm: () => void;
}
