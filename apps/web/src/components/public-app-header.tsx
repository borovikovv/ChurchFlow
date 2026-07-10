'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_ROUTES } from '@/routes';

export function PublicAppHeader() {
  const pathname = usePathname();

  if (pathname === '/o' || pathname.startsWith('/o/')) {
    return null;
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand" href={APP_ROUTES.home}>
          <Image src="/icons/church-flow.svg" alt="ChurchFlow" width={60} height={40} priority />
        </Link>
        <nav className="site-nav" aria-label="Main">
          <Link href={APP_ROUTES.organizationRequest}>Request access</Link>
          <Link href={APP_ROUTES.login}>Sign in</Link>
        </nav>
      </div>
    </header>
  );
}
