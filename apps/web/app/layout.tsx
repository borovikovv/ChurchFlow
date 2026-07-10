import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getCurrentUser, hasServerSession } from '@/auth/session';
import { AppShell } from '@/components/app-shell';
import { getOrganizationAccessState } from '@/features/organizations/server/access';
import { PublicAppHeader } from '@/components/public-app-header';
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
            <PublicAppHeader />
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
