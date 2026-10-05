import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { OrganizationRole } from '@churchflow/db';
import { ORG_PERMISSIONS } from '@churchflow/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequest } from './session-auth.guard';

export type OrganizationPermission = (typeof ORG_PERMISSIONS)[keyof typeof ORG_PERMISSIONS];

const ORGANIZATION_PERMISSION_KEY = 'organizationPermission';
const ORGANIZATION_OWNER_KEY = 'organizationOwner';

export const RequireOrganizationPermission = (permission: OrganizationPermission) =>
  SetMetadata(ORGANIZATION_PERMISSION_KEY, permission);

/**
 * Narrower than any permission: an owner-only route is closed to ADMIN as well, so it cannot be
 * satisfied by the permission bypass below. Used where a decision belongs to the church itself -
 * its public site and its money - rather than to whoever helps run it.
 */
export const RequireOrganizationOwner = () => SetMetadata(ORGANIZATION_OWNER_KEY, true);

@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    const rawOrganizationId = request.params['organizationId'];
    const organizationId = Array.isArray(rawOrganizationId)
      ? rawOrganizationId[0]
      : rawOrganizationId;
    if (!organizationId) {
      throw new BadRequestException('Missing organization id');
    }

    const ownerRequired = this.reflector.getAllAndOverride<boolean | undefined>(
      ORGANIZATION_OWNER_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredPermission = this.reflector.getAllAndOverride<OrganizationPermission | undefined>(
      ORGANIZATION_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    await assertOrganizationAccess(this.prisma, {
      userId,
      organizationId,
      ownerRequired: ownerRequired === true,
      ...(requiredPermission ? { permission: requiredPermission } : {}),
    });

    return true;
  }
}

export interface OrganizationAccessRequirement {
  userId: string;
  organizationId: string;
  ownerRequired?: boolean;
  permission?: OrganizationPermission;
  /**
   * Holds platform admins to the role and permissions of their own membership instead of letting
   * them through. Routes leave it off so the admin area keeps working; the AI assistant sets it,
   * because it acts as a member of the church and must not hand a support account the owner's
   * view.
   */
  enforceMembershipRole?: boolean;
}

export interface OrganizationAccess {
  /**
   * Platform admins pass without a membership; when they have one, its role and permissions
   * are still reported so owner-only features follow the membership, not the platform role.
   */
  platformAdmin: boolean;
  role: OrganizationRole | null;
  permissions: string[];
}

/**
 * The organization boundary every route enforces, shared with callers that act on a user's
 * behalf outside a route - the AI assistant runs one check per tool call instead of one per
 * request, and must refuse exactly what the route would.
 */
export async function assertOrganizationAccess(
  prisma: PrismaService,
  requirement: OrganizationAccessRequirement,
): Promise<OrganizationAccess> {
  const { userId, organizationId } = requirement;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      platformRole: true,
      deletedAt: true,
      memberships: {
        where: {
          organizationId,
          status: 'ACTIVE',
          removedAt: null,
          organization: {
            status: 'ACTIVE',
            deletedAt: null,
          },
        },
        select: {
          role: true,
          permissions: true,
        },
        take: 1,
      },
    },
  });

  if (!user || user.deletedAt !== null) {
    throw new UnauthorizedException('Authenticated user was not found');
  }

  if (user.platformRole === 'ADMIN' || user.platformRole === 'SUPER_ADMIN') {
    const organization = await prisma.organization.findFirst({
      where: { id: organizationId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (!organization) {
      throw new ForbiddenException('Organization access is required');
    }

    const adminMembership = user.memberships[0];
    const adminAccess: OrganizationAccess = {
      platformAdmin: true,
      role: adminMembership?.role ?? null,
      permissions: adminMembership?.permissions ?? [],
    };
    if (requirement.enforceMembershipRole) {
      assertMembershipRequirement(adminAccess, requirement);
    }

    return adminAccess;
  }

  const membership = user.memberships[0];
  if (!membership) {
    throw new ForbiddenException('Organization access is required');
  }

  const access: OrganizationAccess = {
    platformAdmin: false,
    role: membership.role,
    permissions: membership.permissions,
  };

  assertMembershipRequirement(access, requirement);

  return access;
}

function assertMembershipRequirement(
  access: OrganizationAccess,
  requirement: OrganizationAccessRequirement,
): void {
  if (requirement.ownerRequired && access.role !== 'OWNER') {
    throw new ForbiddenException('Organization owner role is required');
  }

  if (!requirement.permission || access.role === 'OWNER' || access.role === 'ADMIN') {
    return;
  }

  if (!access.permissions.includes(requirement.permission)) {
    throw new ForbiddenException('Organization permission is required');
  }
}
