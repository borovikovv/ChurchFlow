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
import { ORG_PERMISSIONS } from '@churchflow/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequest } from './session-auth.guard';

export type OrganizationPermission = (typeof ORG_PERMISSIONS)[keyof typeof ORG_PERMISSIONS];

const ORGANIZATION_PERMISSION_KEY = 'organizationPermission';
const ORGANIZATION_OWNER_KEY = 'organizationOwner';

export const RequireOrganizationPermission = (permission: OrganizationPermission) =>
  SetMetadata(ORGANIZATION_PERMISSION_KEY, permission);

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

    const user = await this.prisma.user.findUnique({
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
      const organization = await this.prisma.organization.findFirst({
        where: { id: organizationId, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      });
      if (!organization) {
        throw new ForbiddenException('Organization access is required');
      }

      return true;
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new ForbiddenException('Organization access is required');
    }

    const ownerRequired = this.reflector.getAllAndOverride<boolean | undefined>(
      ORGANIZATION_OWNER_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (ownerRequired && membership.role !== 'OWNER') {
      throw new ForbiddenException('Organization owner role is required');
    }

    const requiredPermission = this.reflector.getAllAndOverride<OrganizationPermission | undefined>(
      ORGANIZATION_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission || membership.role === 'OWNER' || membership.role === 'ADMIN') {
      return true;
    }

    if (!membership.permissions.includes(requiredPermission)) {
      throw new ForbiddenException('Organization permission is required');
    }

    return true;
  }
}
