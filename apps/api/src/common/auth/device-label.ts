const BROWSERS: ReadonlyArray<{ label: string; match: RegExp; exclude?: RegExp }> = [
  { label: 'Edge', match: /\bEdg[A-Z]?\// },
  { label: 'Opera', match: /\bOPR\// },
  { label: 'Firefox', match: /\bFirefox\// },
  { label: 'Chrome', match: /\bChrome\//, exclude: /\bEdg[A-Z]?\/|\bOPR\// },
  { label: 'Safari', match: /\bSafari\//, exclude: /\bChrome\// },
];

const PLATFORMS: ReadonlyArray<{ label: string; match: RegExp }> = [
  { label: 'iPhone', match: /\biPhone\b/ },
  { label: 'iPad', match: /\biPad\b/ },
  { label: 'Android', match: /\bAndroid\b/ },
  { label: 'Windows', match: /\bWindows\b/ },
  { label: 'macOS', match: /\bMac OS X\b|\bMacintosh\b/ },
  { label: 'Linux', match: /\bLinux\b/ },
];

function firstMatch(
  userAgent: string,
  candidates: ReadonlyArray<{ label: string; match: RegExp; exclude?: RegExp }>,
): string | undefined {
  return candidates.find(({ match, exclude }) => match.test(userAgent) && !exclude?.test(userAgent))
    ?.label;
}

// A hint that helps someone recognise their own device in a session list, nothing more.
// User agents are self-reported and change on every browser update, so this is never
// treated as identification and an unrecognised agent simply has no label.
export function deviceLabelFromUserAgent(userAgent: string | undefined): string | undefined {
  if (!userAgent) {
    return undefined;
  }

  const browser = firstMatch(userAgent, BROWSERS);
  const platform = firstMatch(userAgent, PLATFORMS);

  if (browser && platform) {
    return `${browser} on ${platform}`;
  }

  return browser ?? platform;
}
