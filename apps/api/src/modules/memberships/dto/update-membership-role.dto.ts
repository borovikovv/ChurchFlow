import { updateOrganizationMemberRoleSchema } from '@churchflow/shared';
import type { UpdateOrganizationMemberRoleInput } from '@churchflow/shared';

export class UpdateMembershipRoleDto implements UpdateOrganizationMemberRoleInput {
  static readonly schema = updateOrganizationMemberRoleSchema;

  role!: UpdateOrganizationMemberRoleInput['role'];
}
