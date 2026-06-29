import {
  ConflictException,
  GoneException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PlatformAdminBootstrapRepository } from './platform-admin-bootstrap.repository';

@Injectable()
export class PlatformAdminBootstrapService {
  constructor(private readonly repository: PlatformAdminBootstrapRepository) {}

  async validate(rawToken: string) {
    return this.repository.getState(this.hashToken(rawToken));
  }

  async consume(rawToken: string, actorUserId: string) {
    try {
      await this.repository.consume(this.hashToken(rawToken), actorUserId);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'PLATFORM_ADMIN_ALREADY_EXISTS') {
        throw new ConflictException('A platform super admin already exists');
      }
      if (error instanceof Error && error.message === 'BOOTSTRAP_USER_NOT_ELIGIBLE') {
        throw new UnauthorizedException('An active Telegram account is required');
      }
      if (error instanceof Error && error.message === 'BOOTSTRAP_TOKEN_UNAVAILABLE') {
        throw new GoneException('Bootstrap token is expired, consumed, or invalid');
      }

      throw error;
    }

    return { redirectTo: '/admin/organizations' };
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
