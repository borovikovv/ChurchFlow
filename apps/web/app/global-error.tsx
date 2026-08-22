'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="section">
          <div className="shell stack max-w-xl">
            <h1>Something went wrong</h1>
            <p>ChurchFlow could not be reached. Your session is still active.</p>
            <button className="ui-button ui-button-primary" type="button" onClick={reset}>
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
