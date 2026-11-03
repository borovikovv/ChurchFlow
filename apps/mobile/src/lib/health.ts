import { API_URL } from './config';

export type ApiHealth = 'ok' | 'unreachable';

export async function checkApiHealth(
  fetchImpl: typeof fetch = fetch,
  baseUrl: string = API_URL,
): Promise<ApiHealth> {
  try {
    const response = await fetchImpl(`${baseUrl}/health`);
    if (!response.ok) return 'unreachable';
    const body: unknown = await response.json();
    const status =
      typeof body === 'object' && body !== null ? (body as { status?: unknown }).status : undefined;
    return status === 'ok' ? 'ok' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}
