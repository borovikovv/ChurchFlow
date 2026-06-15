import { cookies } from 'next/headers';
import type { ApiResult } from '@churchflow/shared';
import { serverEnv } from '@/env/server';

type ApiError = Extract<ApiResult<unknown>, { ok: false }>['error'];

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { useInternalUrl?: boolean } = {}
): Promise<ApiResult<T>> {
  const cookieStore = await cookies();
  const baseUrl = init.useInternalUrl === false ? serverEnv.NEXT_PUBLIC_API_URL : serverEnv.API_INTERNAL_URL;
  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        cookie: cookieStore.toString(),
        ...init.headers
      },
      cache: init.cache ?? 'no-store'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'API request failed';

    return {
      ok: false,
      error: {
        code: 'API_UNREACHABLE',
        message
      }
    };
  }

  if (!response.ok) {
    let error: ApiError | undefined;
    try {
      const body = (await response.json()) as unknown;
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
          message: body.error.message
        };
      }
    } catch {
      error = undefined;
    }

    return {
      ok: false,
      error: error ?? {
        code: `HTTP_${response.status}`,
        message: 'Request failed'
      }
    };
  }

  return {
    ok: true,
    data: (await response.json()) as T
  };
}
