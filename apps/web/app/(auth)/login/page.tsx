import { startProviderLogin } from './actions';

const providers = [
  { id: 'telegram', label: 'Continue with Telegram', mark: 'T' },
] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const { redirectTo, error } = await searchParams;

  return (
    <main className="section">
      <div className="shell stack auth-panel">
        <h1>Sign in</h1>
        <p>Use one of the configured third-party sign-in methods for ChurchFlow.</p>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="auth-provider-list" aria-label="Sign-in providers">
          {providers.map((provider) => (
            <form key={provider.id} action={startProviderLogin}>
              <input type="hidden" name="redirectTo" value={redirectTo ?? ''} />
              <input type="hidden" name="provider" value={provider.id} />
              <button className="auth-provider-button" type="submit">
                <span className="auth-provider-mark">{provider.mark}</span>
                {provider.label}
              </button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
