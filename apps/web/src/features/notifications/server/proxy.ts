import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/auth/auth-cookies';
import { serverEnv } from '@/env/server';

export async function proxyApiRequest(path: string, init: RequestInit = {}): Promise<NextResponse> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  try {
    const response = await sendApiRequest(path, init, cookieHeader);

    return apiResponse(response, { clearAuthCookies: response.status === 401 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'API request failed';
    return NextResponse.json(
      { ok: false, error: { code: 'API_UNREACHABLE', message } },
      { status: 502 },
    );
  }
}

async function sendApiRequest(
  path: string,
  init: RequestInit,
  cookieHeader: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('accept', headers.get('accept') ?? 'application/json');
  headers.set('cookie', cookieHeader);

  return fetch(`${serverEnv.API_INTERNAL_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
}

async function apiResponse(
  apiResponse: Response,
  options: { clearAuthCookies?: boolean } = {},
): Promise<NextResponse> {
  const body = await apiResponse.text();
  const response = new NextResponse(body, {
    status: apiResponse.status,
    headers: {
      'content-type': apiResponse.headers.get('content-type') ?? 'application/json',
    },
  });

  if (options.clearAuthCookies) {
    clearAuthCookies(response);
  }

  return response;
}
