import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { AUTH_COOKIE_NAMES } from '@churchflow/shared';
import { apiFetch } from '@/api/client';
import { getOrganizationAccessState } from '@/features/organizations/server/access';
import { organizationHomeRoute } from '@/features/organizations/routes';

export type PlatformRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export interface CurrentUser {
  id: string;
  email: string | null;
  displayName: string | null;
  platformRole: PlatformRole;
  baptizedAt: string | null;
  baptismChurchName: string | null;
}

export function isPlatformAdminRole(role: PlatformRole | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export async function hasServerSession(): Promise<boolean> {
  const cookieStore = await cookies();
  // Middleware validates/refreshes the session before application routes execute.
  // The refresh cookie is only a session candidate; API guards remain authoritative.
  return cookieStore.has(AUTH_COOKIE_NAMES.access) || cookieStore.has(AUTH_COOKIE_NAMES.refresh);
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

export async function getPostLoginRedirect(): Promise<Route> {
  const access = await getOrganizationAccessState();

  if (access.canOpenAdmin) {
    return '/admin/organizations' as Route;
  }

  if (access.organizations[0]) {
    return organizationHomeRoute(access.organizations[0].id);
  }

  return '/organization-request/status' as Route;
}

export async function requireAdminOrganizationsAccess(redirectTo: string): Promise<void> {
  if (!(await hasServerSession())) {
    redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}` as Route);
  }

  const access = await getOrganizationAccessState();
  if (access.canOpenAdmin) {
    return;
  }

  if (access.organizations[0]) {
    redirect(organizationHomeRoute(access.organizations[0].id));
  }

  redirect('/organization-request/status' as Route);
}
