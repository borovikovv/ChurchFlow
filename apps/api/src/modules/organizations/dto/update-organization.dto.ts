import { updateOrganizationSchema } from '@churchflow/shared';
import type { UpdateOrganizationInput } from '@churchflow/shared';

export class UpdateOrganizationDto implements UpdateOrganizationInput {
  static readonly schema = updateOrganizationSchema;

  name?: string;
  slug?: string;
  description?: string | null;
}
