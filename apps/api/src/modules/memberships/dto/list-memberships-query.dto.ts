import { listOrganizationMembersQuerySchema } from '@churchflow/shared';
import type { ListOrganizationMembersQuery } from '@churchflow/shared';

export class ListMembershipsQueryDto implements ListOrganizationMembersQuery {
  static readonly schema = listOrganizationMembersQuerySchema;

  access!: ListOrganizationMembersQuery['access'];
}
