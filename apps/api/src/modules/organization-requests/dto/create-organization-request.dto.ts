import { createOrganizationRequestSchema } from '@churchflow/shared';
import type { CreateOrganizationRequestInput } from '@churchflow/shared';

export class CreateOrganizationRequestDto implements CreateOrganizationRequestInput {
  static readonly schema = createOrganizationRequestSchema;

  organizationName!: string;
  organizationSlug?: string;
  contactName!: string;
  contactEmail!: string;
  contactPhone?: string;
  message?: string;
}
