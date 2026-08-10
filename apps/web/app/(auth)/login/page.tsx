import Image from 'next/image';
import { getMessages } from '@/i18n/messages';
import { DEFAULT_APP_LOCALE } from '@/i18n/locales';
import { startProviderLogin } from './actions';

const providers = [
  { id: 'telegram', translationKey: 'continueWithTelegram', icon: '/icons/socials/telegram.svg' },
] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const { redirectTo, error } = await searchParams;
  const messages = getMessages(DEFAULT_APP_LOCALE);

  return (
    <main className="section auth-section">
      <div className="shell stack auth-panel">
        <Image
          alt="ChurchFlow"
          className="home-logo"
          height={240}
          priority
          src="/icons/church-flow.svg"
          width={360}
        />
        <h1 className="sr-only">{messages.auth.signInToChurchFlow}</h1>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="auth-provider-list" aria-label={messages.auth.signInProviders}>
          {providers.map((provider) => (
            <form key={provider.id} action={startProviderLogin}>
              <input type="hidden" name="redirectTo" value={redirectTo ?? ''} />
              <input type="hidden" name="provider" value={provider.id} />
              <button className="auth-provider-button" type="submit">
                <span className="auth-provider-mark">
                  <Image src={provider.icon} alt="" width={20} height={20} aria-hidden="true" />
                </span>
                {messages.auth[provider.translationKey]}
              </button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
