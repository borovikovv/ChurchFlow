import { APP_LOCALES, DEFAULT_APP_LOCALE } from './constants.js';
import type { AppLocale } from './types.js';

const UKRAINIAN_LOCALE_LANGUAGES = ['uk', 'ru'] as const;
const UKRAINIAN_LOCALE_REGION = 'UA';

function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value);
}

function appLocaleFromLanguageTag(tag: string): AppLocale | null {
  const [language, region] = tag.split('-');
  if (!language) {
    return null;
  }

  if (region?.toUpperCase() === UKRAINIAN_LOCALE_REGION) {
    return 'uk';
  }

  const normalized = language.toLowerCase();
  if ((UKRAINIAN_LOCALE_LANGUAGES as readonly string[]).includes(normalized)) {
    return 'uk';
  }

  return isAppLocale(normalized) ? normalized : null;
}

export function resolveAppLocaleFromAcceptLanguage(header: string | undefined): AppLocale {
  if (!header) {
    return DEFAULT_APP_LOCALE;
  }

  const tags = header
    .split(',')
    .map((part) => {
      const [tag, ...parameters] = part.trim().split(';');
      const quality = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith('q='));
      const parsedQuality = quality ? Number.parseFloat(quality.slice(2)) : 1;

      return {
        tag: tag?.trim() ?? '',
        quality: Number.isFinite(parsedQuality) ? parsedQuality : 0,
      };
    })
    .filter((entry) => entry.tag.length > 0 && entry.quality > 0)
    .sort((left, right) => right.quality - left.quality);

  for (const { tag } of tags) {
    const locale = appLocaleFromLanguageTag(tag);
    if (locale) {
      return locale;
    }
  }

  return DEFAULT_APP_LOCALE;
}
