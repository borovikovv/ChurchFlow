import Image from 'next/image';

export default function OfflinePage() {
  return (
    <main className="section">
      <div className="shell stack grid-center offline-page">
        <Image src="/icons/church-flow.svg" alt="ChurchFlow" width={180} height={120} priority />
        <div className="stack">
          <h1>You are offline</h1>
          <p>ChurchFlow needs a connection to load your latest organization data.</p>
          <p>Please reconnect to the internet, then try again.</p>
        </div>
      </div>
    </main>
  );
}
