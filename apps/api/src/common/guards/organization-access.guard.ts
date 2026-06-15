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
import type { AuthenticatedRequest } from './jwt-auth.guard';

export type OrganizationPermission = (typeof ORG_PERMISSIONS)[keyof typeof ORG_PERMISSIONS];

const ORGANIZATION_PERMISSION_KEY = 'organizationPermission';

export const RequireOrganizationPermission = (permission: OrganizationPermission) =>
  SetMetadata(ORGANIZATION_PERMISSION_KEY, permission);

@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.auth?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    const rawOrganizationId = request.params['organizationId'];
    const organizationId = Array.isArray(rawOrganizationId) ? rawOrganizationId[0] : rawOrganizationId;
    if (!organizationId) {
      throw new BadRequestException('Missing organization id');
    }

    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
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
    });

    if (!membership) {
      throw new ForbiddenException('Organization access is required');
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
