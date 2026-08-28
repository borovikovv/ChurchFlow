import type { Prisma, PlatformRole } from '@churchflow/db';

export const LOGIN_STATE_SELECT = {
  id: true,
  email: true,
  displayName: true,
  platformRole: true,
  emailVerified: true,
  memberships: {
    where: {
      status: 'ACTIVE',
      removedAt: null,
      organization: { status: 'ACTIVE', deletedAt: null },
    },
    select: { id: true },
  },
  requestedOrganizationRequests: { select: { status: true } },
  requestedMembershipClaims: {
    where: { status: { in: ['REQUESTED', 'APPROVED', 'REJECTED'] } },
    select: { id: true },
    take: 1,
  },
} satisfies Prisma.UserSelect;

type LoginStateRow = Prisma.UserGetPayload<{ select: typeof LOGIN_STATE_SELECT }>;

export interface LoginUser {
  id: string;
  email: string | null;
  displayName: string | null;
  platformRole: PlatformRole;
}

export interface LoginUserState {
  user: LoginUser;
  isEmailVerified: boolean;
  hasActiveMembership: boolean;
  hasOrganizationRequest: boolean;
  hasMembershipClaim: boolean;
  isPlatformAdmin: boolean;
}

export function toLoginUserState(row: LoginStateRow): LoginUserState {
  return {
    user: {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      platformRole: row.platformRole,
    },
    isEmailVerified: row.emailVerified !== null,
    hasActiveMembership: row.memberships.length > 0,
    hasOrganizationRequest: row.requestedOrganizationRequests.length > 0,
    hasMembershipClaim: row.requestedMembershipClaims.length > 0,
    isPlatformAdmin: row.platformRole === 'ADMIN' || row.platformRole === 'SUPER_ADMIN',
  };
}

// The same admission question every provider has to answer: an account with no tie to an
// organization has nothing to sign in to, whatever it authenticated with.
export function hasStandingToSignIn(state: LoginUserState): boolean {
  return (
    state.hasActiveMembership ||
    state.isPlatformAdmin ||
    state.hasOrganizationRequest ||
    state.hasMembershipClaim
  );
}

export function resolveLoginRedirect(
  state: LoginUserState,
  requested: string | null,
  admittedByRedirect = false,
): string {
  if (requested && (admittedByRedirect || state.hasActiveMembership)) {
    return requested;
  }

  if (state.isPlatformAdmin) {
    return '/admin/organizations';
  }

  if (state.hasOrganizationRequest && !state.hasActiveMembership) {
    return '/organization-request/status';
  }

  if (state.hasMembershipClaim && !state.hasActiveMembership) {
    return '/member-claims/status';
  }

  return '/';
}
