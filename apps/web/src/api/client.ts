import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAMES, type ApiResult } from '@churchflow/shared';
import { setCookieHeader } from '@/auth/middleware-session';
import { serverEnv } from '@/env/server';

type ApiError = Extract<ApiResult<unknown>, { ok: false }>['error'];

async function readJsonBody<T>(response: Response): Promise<T | undefined> {
  const text = await response.text();

  if (!text.trim()) {
    return undefined;
  }

  return JSON.parse(text) as T;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { useInternalUrl?: boolean } = {},
): Promise<ApiResult<T>> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const baseUrl =
    init.useInternalUrl === false ? serverEnv.NEXT_PUBLIC_API_URL : serverEnv.API_INTERNAL_URL;
  let response: Response;

  try {
    response = await sendApiRequest(baseUrl, path, init, cookieHeader);

    if (response.status === 401) {
      const refreshed = await refreshAccessToken(cookieHeader);
      if (refreshed) {
        response = await sendApiRequest(
          baseUrl,
          path,
          init,
          setCookieHeader(cookieHeader, AUTH_COOKIE_NAMES.access, refreshed.accessToken),
        );
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'API request failed';

    return {
      ok: false,
      error: {
        code: 'API_UNREACHABLE',
        message,
      },
    };
  }

  if (!response.ok) {
    let error: ApiError | undefined;
    try {
      const body = await readJsonBody<unknown>(response);
      if (
        typeof body === 'object' &&
        body !== null &&
        'ok' in body &&
        body.ok === false &&
        'error' in body &&
        typeof body.error === 'object' &&
        body.error !== null &&
        'code' in body.error &&
        'message' in body.error &&
        typeof body.error.code === 'string' &&
        typeof body.error.message === 'string'
      ) {
        error = {
          code: body.error.code,
          message: body.error.message,
        };
      }
    } catch {
      error = undefined;
    }

    return {
      ok: false,
      error: error ?? {
        code: `HTTP_${response.status}`,
        message: 'Request failed',
      },
    };
  }

  return {
    ok: true,
    data: (await readJsonBody<T>(response)) as T,
  };
}

function sendApiRequest(
  baseUrl: string,
  path: string,
  init: RequestInit & { useInternalUrl?: boolean },
  cookieHeader: string,
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      cookie: cookieHeader,
      ...init.headers,
    },
    cache: init.cache ?? 'no-store',
  });
}

async function refreshAccessToken(
  cookieHeader: string,
): Promise<{ accessToken: string } | undefined> {
  const response = await fetch(`${serverEnv.API_INTERNAL_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      cookie: cookieHeader,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return undefined;
  }

  const body = (await response.json()) as unknown;
  if (isRecord(body) && typeof body['accessToken'] === 'string') {
    return { accessToken: body['accessToken'] };
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
