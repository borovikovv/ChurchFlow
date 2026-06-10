import { createOrganizationInvitationSchema } from '@churchflow/shared';
import type { CreateOrganizationInvitationInput } from '@churchflow/shared';

export class CreateOrganizationInvitationDto implements CreateOrganizationInvitationInput {
  static readonly schema = createOrganizationInvitationSchema;

  email!: string;
  role!: CreateOrganizationInvitationInput['role'];
}
