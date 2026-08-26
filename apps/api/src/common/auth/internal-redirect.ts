const UNSAFE_ENCODED_REDIRECT_CHARACTERS = /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i;

export function parseInternalRedirectUrl(value: string | undefined, webAppUrl: string): URL | null {
  if (!value) {
    return null;
  }

  try {
    const appUrl = new URL(webAppUrl);
    const redirectUrl = new URL(value, appUrl);

    return redirectUrl.origin === appUrl.origin ? redirectUrl : null;
  } catch {
    return null;
  }
}

export function normalizeInternalRedirect(
  value: string | undefined,
  webAppUrl: string,
): string | undefined {
  if (
    !value ||
    hasUnsafeRedirectCharacters(value) ||
    UNSAFE_ENCODED_REDIRECT_CHARACTERS.test(value)
  ) {
    return undefined;
  }

  const redirectUrl = parseInternalRedirectUrl(value, webAppUrl);
  if (!redirectUrl) {
    return undefined;
  }

  return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
}

export function extractRedirectToken(redirectTo: string | undefined, path: string): string | null {
  if (!redirectTo) {
    return null;
  }

  const queryIndex = redirectTo.indexOf('?');
  if (queryIndex < 0 || redirectTo.slice(0, queryIndex) !== path) {
    return null;
  }

  return new URLSearchParams(redirectTo.slice(queryIndex + 1)).get('token');
}

function hasUnsafeRedirectCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return character === '\\' || codePoint === undefined || codePoint <= 31 || codePoint === 127;
  });
}
