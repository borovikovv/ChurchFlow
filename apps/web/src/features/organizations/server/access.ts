import type { Entitlement, SubscriptionStatus } from '@churchflow/shared';
import { apiFetch } from '@/api/client';

export type OrganizationMembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type PlatformRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';
export type OrganizationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

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
  website: {
    logoAssetId: string | null;
  } | null;
  subscriptionStatus: SubscriptionStatus | null;
  entitlements: Entitlement[];
  _count?: {
    members: number;
    invitations: number;
  };
}

export interface OrganizationRequestAccessRecord {
  id: string;
  organizationName: string;
  organizationSlug: string | null;
  contactName: string;
  status: OrganizationRequestStatus;
  createdAt: string;
  createdOrganization: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface OrganizationAccessState {
  organizations: OrganizationAccessRecord[];
  organizationRequests: OrganizationRequestAccessRecord[];
  isPlatformAdmin: boolean;
  canOpenAdmin: boolean;
}

export function isOrganizationAdminRole(role: OrganizationMembershipRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function isPlatformAdminRoleValue(role: PlatformRole | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

/**
 * The web layer never decides what a subscription allows; it reads the entitlements the API
 * resolved. Keeping a second copy of the rules here is how the two drift apart.
 */
export function organizationHasEntitlement(
  organization: OrganizationAccessRecord | undefined,
  entitlement: Entitlement,
): boolean {
  return organization?.entitlements?.includes(entitlement) ?? false;
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
  const organizationRequestsPromise = apiFetch<OrganizationRequestAccessRecord[]>(
    '/organization-requests/mine',
  );
  const [user, organizationsResult, organizationRequestsResult] = await Promise.all([
    userPromise,
    organizationsPromise,
    organizationRequestsPromise,
  ]);
  const organizations = organizationsResult.ok ? organizationsResult.data : [];
  const organizationRequests = organizationRequestsResult.ok ? organizationRequestsResult.data : [];
  const isPlatformAdmin = isPlatformAdminRoleValue(user?.platformRole);

  return {
    organizations,
    organizationRequests,
    isPlatformAdmin,
    canOpenAdmin:
      isPlatformAdmin ||
      organizations.some((organization) => isOrganizationAdminRole(organization.role)) ||
      organizationRequests.length > 0,
  };
}
