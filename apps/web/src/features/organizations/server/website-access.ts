import { notFound } from 'next/navigation';
import { getOrganizationAccessState, isOrganizationAdminRole } from './access';

export async function requireWebsiteManageAccess(organizationId: string) {
  const access = await getOrganizationAccessState();
  const organization = access.organizations.find((item) => item.id === organizationId);

  if (!organization || !isOrganizationAdminRole(organization.role)) {
    notFound();
  }

  return organization;
}
