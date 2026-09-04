import { notFound } from 'next/navigation';
import { getOrganizationAccessState, isOrganizationOwnerRole } from './access';

export async function requireOrganizationOwnerAccess(organizationId: string) {
  const access = await getOrganizationAccessState();
  const organization = access.organizations.find((item) => item.id === organizationId);

  if (!organization || !isOrganizationOwnerRole(organization.role)) {
    notFound();
  }

  return organization;
}
