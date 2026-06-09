import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAMES } from '@churchflow/shared';

export async function hasServerSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.has(AUTH_COOKIE_NAMES.access);
}
