import en from '../../messages/en.json';
import uk from '../../messages/uk.json';
import { DEFAULT_APP_LOCALE, type AppLocale } from './locales';

const messages = { en, uk } as const;

export type AppMessages = typeof en;

export function getMessages(locale: AppLocale): AppMessages {
  return messages[locale] ?? messages[DEFAULT_APP_LOCALE];
}
