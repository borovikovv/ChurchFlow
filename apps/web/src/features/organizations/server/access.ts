import { apiFetch } from '@/api/client';

export type OrganizationMembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type PlatformRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export interface CurrentUserForAccess {
  platformRole: PlatformRole;
}

export interface OrganizationAccessRecord {
  id: string;
  name: string;
  slug: string;
  status: string;
  description: string | null;
  createdAt: string;
  role: OrganizationMembershipRole;
}

export interface OrganizationAccessState {
  organizations: OrganizationAccessRecord[];
  isPlatformAdmin: boolean;
  canOpenAdmin: boolean;
}

export function isOrganizationAdminRole(role: OrganizationMembershipRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function isPlatformAdminRoleValue(role: PlatformRole | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export async function getOrganizationAccessState(
  currentUser?: CurrentUserForAccess | null,
): Promise<OrganizationAccessState> {
  const userPromise =
    currentUser === undefined
      ? apiFetch<CurrentUserForAccess>('/users/me').then((result) =>
          result.ok ? result.data : null,
        )
      : Promise.resolve(currentUser);
  const organizationsPromise = apiFetch<OrganizationAccessRecord[]>('/organizations/mine');
  const [user, organizationsResult] = await Promise.all([userPromise, organizationsPromise]);
  const organizations = organizationsResult.ok ? organizationsResult.data : [];
  const isPlatformAdmin = isPlatformAdminRoleValue(user?.platformRole);

  return {
    organizations,
    isPlatformAdmin,
    canOpenAdmin:
      isPlatformAdmin ||
      organizations.some((organization) => isOrganizationAdminRole(organization.role)),
  };
}
