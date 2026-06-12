import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { AUTH_COOKIE_NAMES } from '@churchflow/shared';
import { apiFetch } from '@/api/client';

export type PlatformRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export interface CurrentUser {
  id: string;
  email: string | null;
  displayName: string | null;
  platformRole: PlatformRole;
}

export function isPlatformAdminRole(role: PlatformRole | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export async function hasServerSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.has(AUTH_COOKIE_NAMES.access);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const result = await apiFetch<CurrentUser>('/users/me');

  return result.ok ? result.data : null;
}

export async function isPlatformAdmin(): Promise<boolean> {
  const user = await getCurrentUser();

  return isPlatformAdminRole(user?.platformRole);
}

export async function requireServerSession(redirectTo: string): Promise<void> {
  if (await hasServerSession()) {
    return;
  }

  redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}` as Route);
}

export async function requirePlatformAdmin(redirectTo: string): Promise<void> {
  if (!(await hasServerSession())) {
    redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}` as Route);
  }

  if (await isPlatformAdmin()) {
    return;
  }

  redirect('/' as Route);
}
