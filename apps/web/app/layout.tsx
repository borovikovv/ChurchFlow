import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'ChurchFlow',
  description: 'Multi-tenant organization websites and administration'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link className="brand" href="/">
              ChurchFlow
            </Link>
            <nav className="site-nav" aria-label="Main">
              <Link href="/organization-request">Request access</Link>
              <Link href="/admin/organization-requests">Admin</Link>
              <Link href="/login">Sign in</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
