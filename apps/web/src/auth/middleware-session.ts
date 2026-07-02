export async function isAccessTokenFresh(
  token: string,
  publicKeyPem: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature || !publicKeyPem) {
    return false;
  }

  try {
    const decodedHeader = JSON.parse(base64UrlDecode(header)) as unknown;
    const decoded = JSON.parse(base64UrlDecode(payload)) as unknown;
    if (
      !isRecord(decodedHeader) ||
      decodedHeader['alg'] !== 'RS256' ||
      !isRecord(decoded) ||
      typeof decoded['exp'] !== 'number' ||
      decoded['exp'] <= nowSeconds + 5
    ) {
      return false;
    }

    const publicKey = await crypto.subtle.importKey(
      'spki',
      pemPublicKeyBytes(publicKeyPem),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    return crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      base64UrlBytes(signature),
      new TextEncoder().encode(`${header}.${payload}`),
    );
  } catch {
    return false;
  }
}

export function setCookieHeader(
  currentCookieHeader: string | null,
  name: string,
  value: string,
): string {
  const cookies = (currentCookieHeader ?? '')
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .filter((cookie) => {
      const separator = cookie.indexOf('=');
      return separator < 0 || cookie.slice(0, separator).trim() !== name;
    });

  cookies.push(`${name}=${encodeURIComponent(value)}`);
  return cookies.join('; ');
}

export function internalRedirectTarget(pathname: string, search: string): string {
  const safePathname = pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/';
  const safeSearch = search.startsWith('?') ? search : '';

  return `${safePathname}${safeSearch}`;
}

function base64UrlDecode(value: string): string {
  return new TextDecoder().decode(base64UrlBytes(value));
}

function base64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const decoded = atob(padded);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return bytes;
}

function pemPublicKeyBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value
    .replace(/\\n/g, '\n')
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '');

  return base64UrlBytes(base64);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
