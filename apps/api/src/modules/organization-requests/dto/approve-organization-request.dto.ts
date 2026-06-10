import { approveOrganizationRequestSchema } from '@churchflow/shared';
import type { ApproveOrganizationRequestInput } from '@churchflow/shared';

export class ApproveOrganizationRequestDto implements ApproveOrganizationRequestInput {
  static readonly schema = approveOrganizationRequestSchema;

  organizationSlug?: string;
  organizationName?: string;
}
