import { APP_LOCALES, DEFAULT_APP_LOCALE, type AppLocale } from '@churchflow/shared';

export { APP_LOCALES, DEFAULT_APP_LOCALE };
export type { AppLocale };

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && APP_LOCALES.includes(value as AppLocale);
}
