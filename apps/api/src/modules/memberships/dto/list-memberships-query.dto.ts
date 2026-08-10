import { listOrganizationMembersQuerySchema } from '@churchflow/shared';
import type { ListOrganizationMembersQuery } from '@churchflow/shared';

export class ListMembershipsQueryDto implements ListOrganizationMembersQuery {
  static readonly schema = listOrganizationMembersQuerySchema;

  access!: ListOrganizationMembersQuery['access'];
  membershipId!: ListOrganizationMembersQuery['membershipId'];
  ministries!: ListOrganizationMembersQuery['ministries'];
  page!: ListOrganizationMembersQuery['page'];
  pageSize!: ListOrganizationMembersQuery['pageSize'];
  search!: ListOrganizationMembersQuery['search'];
  type!: ListOrganizationMembersQuery['type'];
}
