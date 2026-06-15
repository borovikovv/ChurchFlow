import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequest } from './jwt-auth.guard';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.auth?.sub;

    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { platformRole: true, deletedAt: true }
    });

    if (!user || user.deletedAt !== null) {
      throw new UnauthorizedException('Authenticated user was not found');
    }

    if (user.platformRole !== 'ADMIN' && user.platformRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Platform admin access is required');
    }

    return true;
  }
}
