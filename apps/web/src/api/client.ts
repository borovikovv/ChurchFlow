import { cookies } from 'next/headers';
import { type ApiResult } from '@churchflow/shared';
import { serverEnv } from '@/env/server';

type ApiError = Extract<ApiResult<unknown>, { ok: false }>['error'];

export const UNAUTHENTICATED_ERROR_CODE = 'UNAUTHENTICATED';

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

  if (response.status === 401) {
    return {
      ok: false,
      error: { code: UNAUTHENTICATED_ERROR_CODE, message: 'Session is no longer active' },
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
