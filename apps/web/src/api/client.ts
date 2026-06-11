import { cookies } from 'next/headers';
import type { ApiResult } from '@churchflow/shared';
import { serverEnv } from '@/env/server';

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
    return {
      ok: false,
      error: {
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
