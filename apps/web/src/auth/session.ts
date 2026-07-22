import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { AUTH_COOKIE_NAMES, type AppLocale } from '@churchflow/shared';
import { apiFetch } from '@/api/client';
import {
  getOrganizationAccessState,
  isOrganizationAdminRole,
} from '@/features/organizations/server/access';
import { organizationHomeRoute, organizationProfileRoute } from '@/features/organizations/routes';
import { APP_ROUTES } from '@/routes';

export type PlatformRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export interface CurrentUser {
  id: string;
  email: string | null;
  displayName: string | null;
  platformRole: PlatformRole;
  baptizedAt: string | null;
  baptismChurchName: string | null;
  locale: AppLocale;
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

interface MembershipClaimStatusRecord {
  id: string;
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

export async function getPostLoginRedirect(
  options: { organizationRoute?: 'home' | 'profile' } = {},
): Promise<Route> {
  const access = await getOrganizationAccessState();
  const organizationRoute = options.organizationRoute ?? 'home';

  if (access.isPlatformAdmin) {
    return APP_ROUTES.adminOrganizations;
  }

  if (access.organizations.length === 1) {
    const organization = access.organizations[0];
    if (!organization) {
      return APP_ROUTES.organizationRequest;
    }

    const organizationId = organization.id;
    return organizationRoute === 'profile'
      ? organizationProfileRoute(organizationId)
      : organizationHomeRoute(organizationId);
  }

  if (access.organizations.length > 1) {
    return APP_ROUTES.organizationSelect;
  }

  if (access.organizationRequests.length > 0) {
    return APP_ROUTES.organizationRequestStatus;
  }

  const claimsResult = await apiFetch<MembershipClaimStatusRecord[]>('/membership-claims/status');
  if (claimsResult.ok && claimsResult.data.length > 0) {
    return APP_ROUTES.memberClaimsStatus;
  }

  return APP_ROUTES.organizationRequest;
}

export async function requireAdminOrganizationsAccess(redirectTo: string): Promise<void> {
  if (!(await hasServerSession())) {
    redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}` as Route);
  }

  const access = await getOrganizationAccessState();
  if (
    access.isPlatformAdmin ||
    access.organizations.some((organization) => isOrganizationAdminRole(organization.role)) ||
    access.organizationRequests.length > 0
  ) {
    return;
  }

  redirect(await getPostLoginRedirect());
}
