import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="section">
      <div className="shell stack">
        <h1>ChurchFlow</h1>
        <p>Organization administration, member care, and public websites in one tenant-safe platform.</p>
        <Link className="button" href="/login">
          Sign in
        </Link>
      </div>
    </main>
  );
}
