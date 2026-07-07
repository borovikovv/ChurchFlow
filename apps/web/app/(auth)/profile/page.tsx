import { redirect } from 'next/navigation';
import { getCurrentUser, requireServerSession } from '@/auth/session';
import { getOrganizationAccessState } from '@/features/organizations/server/access';
import { organizationProfileRoute } from '@/features/organizations/routes';
import { APP_ROUTES } from '@/routes';

export default async function ProfilePage() {
  await requireServerSession('/profile');

  const user = await getCurrentUser();
  if (!user) {
    redirect(APP_ROUTES.login);
  }

  const access = await getOrganizationAccessState(user);
  const organization = access.organizations[0];

  if (organization) {
    redirect(organizationProfileRoute(organization.id));
  }

  redirect(
    access.canOpenAdmin ? APP_ROUTES.adminOrganizations : APP_ROUTES.organizationRequestStatus,
  );
}
