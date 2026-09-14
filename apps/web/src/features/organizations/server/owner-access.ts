import { notFound } from 'next/navigation';
import { getOrganizationAccessState, isOrganizationOwnerRole } from './access';

/**
 * The website and the budget belong to the church itself, not to whoever helps run it, so both
 * are owner-only. The API refuses these routes for anyone else; this only keeps an admin from
 * landing on a page that would fail every request it makes.
 */
export async function requireOrganizationOwnerAccess(organizationId: string) {
  const access = await getOrganizationAccessState();
  const organization = access.organizations.find((item) => item.id === organizationId);

  if (!organization || !isOrganizationOwnerRole(organization.role)) {
    notFound();
  }

  return organization;
}
