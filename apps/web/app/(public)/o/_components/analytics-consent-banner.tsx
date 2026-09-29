'use client';

import { useState, useSyncExternalStore } from 'react';
import type { AppLocale } from '@churchflow/shared';
import { readStoredJson, writeStoredJson } from '@/lib/browser-storage';
import {
  ANALYTICS_CONSENT_MESSAGES,
  analyticsConsentStorageKey,
  parseAnalyticsConsent,
  type AnalyticsConsent,
} from '../_lib/website-analytics-consent';

// The server cannot see the visitor's answer, so it renders no banner and the client decides.
const SERVER_SNAPSHOT = 'server';

export function AnalyticsConsentBanner({
  locale,
  orgSlug,
}: {
  locale: AppLocale;
  orgSlug: string;
}) {
  const storageKey = analyticsConsentStorageKey(orgSlug);
  const [answered, setAnswered] = useState(false);
  const stored = useSyncExternalStore(
    subscribeToStorage,
    () => readStoredJson('local', storageKey, parseAnalyticsConsent),
    () => SERVER_SNAPSHOT,
  );
  const messages = ANALYTICS_CONSENT_MESSAGES[locale];

  if (answered || stored !== null) return null;

  const answer = (consent: AnalyticsConsent) => {
    writeStoredJson('local', storageKey, consent);
    updateGtagConsent(consent);
    setAnswered(true);
  };

  return (
    <section
      aria-label={messages.label}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-lg border border-black/10 bg-white p-4 text-sm text-neutral-900 shadow-lg sm:flex-row sm:items-center"
    >
      <p className="m-0 flex-1">{messages.message}</p>
      <div className="flex shrink-0 gap-2">
        <button
          className="cursor-pointer rounded-md border border-black/20 bg-transparent px-4 py-2 font-medium text-neutral-900 hover:bg-black/5"
          type="button"
          onClick={() => answer('denied')}
        >
          {messages.decline}
        </button>
        <button
          className="cursor-pointer rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-700"
          type="button"
          onClick={() => answer('granted')}
        >
          {messages.accept}
        </button>
      </div>
    </section>
  );
}

// Another tab of the same site answering the banner hides it here too.
function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

// gtag is defined by the bootstrap script; it may be missing if a blocker removed it.
function updateGtagConsent(consent: AnalyticsConsent): void {
  const gtag: unknown = Reflect.get(window, 'gtag');
  if (typeof gtag === 'function') gtag('consent', 'update', { analytics_storage: consent });
}
