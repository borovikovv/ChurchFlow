import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { serverEnv } from '@/env/server';

export async function proxyApiRequest(path: string, init: RequestInit = {}): Promise<NextResponse> {
  const cookieStore = await cookies();

  try {
    const response = await fetch(`${serverEnv.API_INTERNAL_URL}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        cookie: cookieStore.toString(),
        ...init.headers,
      },
      cache: 'no-store',
    });
    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'API request failed';
    return NextResponse.json(
      { ok: false, error: { code: 'API_UNREACHABLE', message } },
      { status: 502 },
    );
  }
}
