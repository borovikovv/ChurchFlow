'use client';

// Last resort: the root layout itself failed, so no provider, locale or shared UI is
// available here. Everything is inlined and the copy stays in English on purpose.
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
