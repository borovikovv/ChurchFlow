import { listAdminOrganizationWorkspaceQuerySchema } from '@churchflow/shared';
import type { ListAdminOrganizationWorkspaceQuery } from '@churchflow/shared';

export class ListAdminOrganizationWorkspaceQueryDto implements ListAdminOrganizationWorkspaceQuery {
  static readonly schema = listAdminOrganizationWorkspaceQuerySchema;

  status?: ListAdminOrganizationWorkspaceQuery['status'];
  view?: ListAdminOrganizationWorkspaceQuery['view'];
}
