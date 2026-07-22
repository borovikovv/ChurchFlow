import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_APP_LOCALE, isAppLocale } from './locales';
import { getMessages } from './messages';

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;
  const locale = isAppLocale(requestedLocale) ? requestedLocale : DEFAULT_APP_LOCALE;

  return {
    locale,
    messages: getMessages(locale),
  };
});
