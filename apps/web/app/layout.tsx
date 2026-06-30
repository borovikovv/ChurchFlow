import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { getCurrentUser, hasServerSession, isPlatformAdminRole } from '@/auth/session';
import { AppShell } from '@/components/app-shell';
import { ToastProvider } from '@/components/toast-provider';
import 'react-toastify/dist/ReactToastify.css';
import 'react-phone-number-input/style.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'ChurchFlow',
  description: 'Multi-tenant organization websites and administration',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const hasSession = await hasServerSession();
  const user = hasSession ? await getCurrentUser() : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {user ? (
          <AppShell
            isPlatformAdmin={isPlatformAdminRole(user.platformRole)}
            displayName={user.displayName ?? user.email ?? 'ChurchFlow user'}
          >
            {children}
          </AppShell>
        ) : (
          <>
            <header className="site-header">
              <div className="site-header-inner">
                <Link className="brand" href="/">
                  <Image
                    src="/icons/church-flow.svg"
                    alt="ChurchFlow"
                    width={60}
                    height={40}
                    priority
                  />
                </Link>
                <nav className="site-nav" aria-label="Main">
                  <Link href="/organization-request">Request access</Link>
                  <Link href="/login">Sign in</Link>
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
