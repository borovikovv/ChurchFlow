export type BrowserApiResult<T> = { ok: true; data: T } | { ok: false; message: string };

// Sign-in calls go straight to the same-origin /v1 rewrite rather than through a server
// action: the API answers them with the session cookie, and a Set-Cookie returned to the
// Next server never reaches the browser.
export async function postToApi<T>(
  path: string,
  body: unknown,
  fallbackMessage: string,
): Promise<BrowserApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(`/v1${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: fallbackMessage };
  }

  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    return { ok: false, message: errorMessage(payload) ?? fallbackMessage };
  }

  return { ok: true, data: payload as T };
}

function errorMessage(payload: unknown): string | null {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'object' &&
    payload.error !== null &&
    'message' in payload.error &&
    typeof payload.error.message === 'string'
  ) {
    return payload.error.message;
  }

  return null;
}
