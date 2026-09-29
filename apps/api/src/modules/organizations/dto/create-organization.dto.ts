import { createOrganizationSchema } from '@churchflow/shared';
import type { CreateOrganizationInput } from '@churchflow/shared';

export class CreateOrganizationDto implements CreateOrganizationInput {
  static readonly schema = createOrganizationSchema;

  name!: string;
  slug!: string;
  description?: string;
}
