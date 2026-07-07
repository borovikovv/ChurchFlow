import Image from 'next/image';
import Link from 'next/link';
import { getPostLoginRedirect, hasServerSession } from '@/auth/session';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  if (await hasServerSession()) {
    redirect(await getPostLoginRedirect());
  }

  return (
    <main className="section">
      <div className="shell stack home-hero grid-center">
        <Image
          className="home-logo"
          src="/icons/church-flow.svg"
          alt="ChurchFlow"
          width={360}
          height={240}
          priority
        />
        <h1 className="sr-only">ChurchFlow</h1>
        <p>
          Organization administration, member care, and public websites in one tenant-safe platform.
        </p>
        <Link className="button" href={'/login'}>
          Sign in
        </Link>
      </div>
    </main>
  );
}
