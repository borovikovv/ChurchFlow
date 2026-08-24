import { listOrganizationMembersQuerySchema } from '@churchflow/shared';
import type { ListOrganizationMembersQuery } from '@churchflow/shared';

export class ListMembershipsQueryDto implements ListOrganizationMembersQuery {
  static readonly schema = listOrganizationMembersQuerySchema;

  access!: ListOrganizationMembersQuery['access'];
  cursor!: ListOrganizationMembersQuery['cursor'];
  membershipId!: ListOrganizationMembersQuery['membershipId'];
  ministries!: ListOrganizationMembersQuery['ministries'];
  page!: ListOrganizationMembersQuery['page'];
  pageSize!: ListOrganizationMembersQuery['pageSize'];
  search!: ListOrganizationMembersQuery['search'];
  tab!: ListOrganizationMembersQuery['tab'];
  type!: ListOrganizationMembersQuery['type'];
}
