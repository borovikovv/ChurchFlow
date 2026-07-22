import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { Suspense } from 'react';
import { getCurrentUser, hasServerSession } from '@/auth/session';
import { AppShell } from '@/components/app-shell';
import {
  getOrganizationAccessState,
  isOrganizationAdminRole,
  type OrganizationAccessRecord,
} from '@/features/organizations/server/access';
import { PublicAppHeader } from '@/components/public-app-header';
import { QueryProvider } from '@/components/query-provider';
import { ToastProvider } from '@/components/toast-provider';
import { DEFAULT_APP_LOCALE, isAppLocale } from '@/i18n/locales';
import { getMessages } from '@/i18n/messages';
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
  const adminOrganizationIds = adminOrganizationIdsFromAccess(access?.organizations);
  const locale = isAppLocale(user?.locale) ? user.locale : DEFAULT_APP_LOCALE;
  const messages = getMessages(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>
            {user ? (
              <AppShell
                canOpenAdmin={access?.canOpenAdmin ?? false}
                budgetOrganizationIds={adminOrganizationIds}
                displayName={user.displayName ?? user.email ?? messages.common.churchFlowUser}
                websiteOrganizationIds={adminOrganizationIds}
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
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

function adminOrganizationIdsFromAccess(
  organizations: OrganizationAccessRecord[] | undefined,
): string[] {
  return (
    organizations
      ?.filter((organization) => isOrganizationAdminRole(organization.role))
      .map((organization) => organization.id) ?? []
  );
}
