import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const GOOGLE_AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export const GOOGLE_ANALYTICS_READONLY_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

// openid and email only name the connected account for the owner; analytics.readonly is the one
// scope that reads data, and ChurchFlow never asks for anything that could change GA settings.
const GOOGLE_ANALYTICS_SCOPES = ['openid', 'email', GOOGLE_ANALYTICS_READONLY_SCOPE];

export interface GoogleOAuthChallenge {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}

export function createGoogleOAuthChallenge(): GoogleOAuthChallenge {
  const codeVerifier = randomBytes(32).toString('base64url');

  return {
    state: randomBytes(24).toString('base64url'),
    codeVerifier,
    codeChallenge: createHash('sha256').update(codeVerifier).digest('base64url'),
  };
}

export function buildGoogleAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(GOOGLE_AUTHORIZATION_URL);
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: GOOGLE_ANALYTICS_SCOPES.join(' '),
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
    // A refresh token is only issued with offline access, and only on a fresh consent: without
    // prompt=consent a reconnect after revocation would come back with no refresh token at all.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'false',
  }).toString();

  return url.toString();
}

export function statesMatch(received: string, expected: string): boolean {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);

  return left.length === right.length && timingSafeEqual(left, right);
}

/** Google lets the user untick individual scopes on the consent screen. */
export function grantsAnalyticsScope(scope: string | undefined): boolean {
  return (scope ?? '').split(' ').includes(GOOGLE_ANALYTICS_READONLY_SCOPE);
}

/**
 * The email claim of an id token received straight from Google's token endpoint over TLS. OpenID
 * Connect allows skipping signature validation for a token obtained this way, and the email is
 * only shown to the owner as a label, never used to authorize anything.
 */
export function readIdTokenEmail(idToken: string | undefined): string | null {
  const payload = idToken?.split('.')[1];
  if (!payload) return null;

  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof claims !== 'object' || claims === null || !('email' in claims)) return null;

    return typeof claims.email === 'string' && claims.email ? claims.email : null;
  } catch {
    return null;
  }
}
