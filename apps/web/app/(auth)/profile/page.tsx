import { redirect } from 'next/navigation';
import { getCurrentUser, getPostLoginRedirect, requireServerSession } from '@/auth/session';
import { APP_ROUTES } from '@/routes';

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireServerSession('/profile');

  const user = await getCurrentUser();
  if (!user) {
    redirect(APP_ROUTES.login);
  }

  const { error } = await searchParams;
  const target = await getPostLoginRedirect({ organizationRoute: 'profile' });

  // The API can only ever send people here: it has no organization to route them to. Whatever
  // it needed to tell them has to survive the hop to the page that can show it.
  redirect(error ? `${target}?error=${encodeURIComponent(error)}` : target);
}
