import { websiteAnalyticsMeasurementIdSchema, type AppLocale } from '@churchflow/shared';

export type AnalyticsConsent = 'granted' | 'denied';

/**
 * Every church site is served from the same origin, so a visitor's answer is stored per site:
 * accepting analytics on one church's site must not switch it on for another.
 */
export function analyticsConsentStorageKey(orgSlug: string): string {
  return `churchflow:analytics-consent:${orgSlug}`;
}

export function parseAnalyticsConsent(value: unknown): AnalyticsConsent | null {
  return value === 'granted' || value === 'denied' ? value : null;
}

/** A measurement id that is safe to put in a script url and an inline script, or null. */
export function publicMeasurementId(value: string | null | undefined): string | null {
  const parsed = websiteAnalyticsMeasurementIdSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

/**
 * Runs before gtag.js loads. Google Consent Mode starts with analytics storage denied, so no
 * cookie is set until the visitor accepts; a visitor who already accepted on an earlier visit is
 * granted straight away. Ads signals stay denied: ChurchFlow sites only measure visits.
 */
export function analyticsBootstrapScript(input: {
  measurementId: string;
  orgSlug: string;
}): string {
  const storageKey = scriptLiteral(analyticsConsentStorageKey(input.orgSlug));
  const measurementId = scriptLiteral(input.measurementId);

  return [
    'window.dataLayer=window.dataLayer||[];',
    'function gtag(){dataLayer.push(arguments);}',
    'var consent="denied";',
    `try{if(JSON.parse(localStorage.getItem(${storageKey}))==="granted")consent="granted";}catch(e){}`,
    'gtag("consent","default",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:consent});',
    'gtag("js",new Date());',
    `gtag("config",${measurementId});`,
  ].join('');
}

// JSON is valid JavaScript for a string, and escaping "<" keeps a value from closing the script.
function scriptLiteral(value: string): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

export const ANALYTICS_CONSENT_MESSAGES = {
  en: {
    label: 'Cookie consent',
    message:
      'This site uses Google Analytics cookies to understand how visitors use it. Nothing is stored until you accept.',
    accept: 'Accept',
    decline: 'Decline',
  },
  uk: {
    label: 'Згода на cookie',
    message:
      'Цей сайт використовує cookie Google Analytics, щоб розуміти, як відвідувачі ним користуються. Нічого не зберігається, доки ви не погодитеся.',
    accept: 'Прийняти',
    decline: 'Відхилити',
  },
} satisfies Record<AppLocale, Record<string, string>>;
