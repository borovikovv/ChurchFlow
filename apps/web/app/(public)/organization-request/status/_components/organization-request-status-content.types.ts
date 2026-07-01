import type { OrganizationRequestStatusItem } from '@churchflow/shared';

export interface OrganizationRequestStatusContentProps {
  initialRequests: OrganizationRequestStatusItem[];
  loadError: string | null;
}
