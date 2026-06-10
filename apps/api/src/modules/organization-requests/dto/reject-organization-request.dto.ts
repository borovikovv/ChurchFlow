import { rejectOrganizationRequestSchema } from '@churchflow/shared';
import type { RejectOrganizationRequestInput } from '@churchflow/shared';

export class RejectOrganizationRequestDto implements RejectOrganizationRequestInput {
  static readonly schema = rejectOrganizationRequestSchema;

  rejectionReason!: string;
}
