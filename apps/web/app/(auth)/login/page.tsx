import Image from 'next/image';
import { getMessages } from '@/i18n/messages';
import { DEFAULT_APP_LOCALE } from '@/i18n/locales';
import { startProviderLogin } from './actions';
import { EmailSignInForm } from './_components/email-sign-in-form';
import { PasskeySignIn } from './_components/passkey-sign-in';

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
        <EmailSignInForm
          messages={{
            emailAddress: messages.auth.emailAddress,
            continueWithEmail: messages.auth.continueWithEmail,
            checkYourEmail: messages.auth.checkYourEmail,
            emailSignInSent: messages.auth.emailSignInSent,
            signInCode: messages.auth.signInCode,
            confirmCode: messages.auth.confirmCode,
            useAnotherEmail: messages.auth.useAnotherEmail,
            signInFailed: messages.auth.signInFailed,
          }}
          redirectTo={redirectTo}
        />
        <PasskeySignIn
          messages={{
            signInWithPasskey: messages.auth.signInWithPasskey,
            passkeySignInFailed: messages.auth.passkeySignInFailed,
          }}
          redirectTo={redirectTo}
        />
        <p className="auth-divider">{messages.auth.orContinueWith}</p>
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
