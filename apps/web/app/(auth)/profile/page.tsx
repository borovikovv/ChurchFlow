import { redirect } from 'next/navigation';
import { getCurrentUser, getPostLoginRedirect, requireServerSession } from '@/auth/session';
import { APP_ROUTES } from '@/routes';

export default async function ProfilePage() {
  await requireServerSession('/profile');

  const user = await getCurrentUser();
  if (!user) {
    redirect(APP_ROUTES.login);
  }

  redirect(await getPostLoginRedirect({ organizationRoute: 'profile' }));
}
