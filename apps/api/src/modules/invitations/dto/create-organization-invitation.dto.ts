import { createOrganizationInvitationSchema } from '@churchflow/shared';
import type { CreateOrganizationInvitationInput } from '@churchflow/shared';

export class CreateOrganizationInvitationDto implements CreateOrganizationInvitationInput {
  static readonly schema = createOrganizationInvitationSchema;

  mode!: CreateOrganizationInvitationInput['mode'];
  targetProvider?: CreateOrganizationInvitationInput['targetProvider'];
  targetProviderAccountId?: string;
  targetDisplay?: string;
  email?: string;
  role!: CreateOrganizationInvitationInput['role'];
}
