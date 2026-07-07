import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { getCurrentUser, hasServerSession } from '@/auth/session';
import { AppShell } from '@/components/app-shell';
import { getOrganizationAccessState } from '@/features/organizations/server/access';
import { APP_ROUTES } from '@/routes';
import { ToastProvider } from '@/components/toast-provider';
import 'react-toastify/dist/ReactToastify.css';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-phone-number-input/style.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'ChurchFlow',
  description: 'Multi-tenant organization websites and administration',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const hasSession = await hasServerSession();
  const user = hasSession ? await getCurrentUser() : null;
  const access = user ? await getOrganizationAccessState(user) : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {user ? (
          <AppShell
            canOpenAdmin={access?.canOpenAdmin ?? false}
            displayName={user.displayName ?? user.email ?? 'ChurchFlow user'}
          >
            {children}
          </AppShell>
        ) : (
          <>
            <header className="site-header">
              <div className="site-header-inner">
                <Link className="brand" href={APP_ROUTES.home}>
                  <Image
                    src="/icons/church-flow.svg"
                    alt="ChurchFlow"
                    width={60}
                    height={40}
                    priority
                  />
                </Link>
                <nav className="site-nav" aria-label="Main">
                  <Link href={APP_ROUTES.organizationRequest}>Request access</Link>
                  <Link href={APP_ROUTES.login}>Sign in</Link>
                </nav>
              </div>
            </header>
            {children}
          </>
        )}
        <Suspense>
          <ToastProvider />
        </Suspense>
      </body>
    </html>
  );
}
