import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Entitlement } from '@churchflow/shared';
import { EntitlementsService } from '../../modules/billing/entitlements.service';
import type { AuthenticatedRequest } from './session-auth.guard';

const SUBSCRIPTION_ENTITLEMENT_KEY = 'subscriptionEntitlement';

export const RequireEntitlement = (entitlement: Entitlement) =>
  SetMetadata(SUBSCRIPTION_ENTITLEMENT_KEY, entitlement);

/**
 * Refuses writes that the organization's subscription does not pay for.
 *
 * Unlike OrganizationAccessGuard this guard has no bypasses. A restricted organization is
 * read-only for its owner and for platform admins alike; the only way through is complimentary
 * access, which a platform admin grants explicitly and which is written to the audit log. That
 * keeps "RESTRICTED means nobody writes" an invariant rather than a default.
 */
@Injectable()
export class SubscriptionEntitlementGuard implements CanActivate {
  constructor(
    private readonly entitlementsService: EntitlementsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredEntitlement = this.reflector.getAllAndOverride<Entitlement | undefined>(
      SUBSCRIPTION_ENTITLEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredEntitlement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawOrganizationId = request.params['organizationId'];
    const organizationId = Array.isArray(rawOrganizationId)
      ? rawOrganizationId[0]
      : rawOrganizationId;
    if (!organizationId) {
      throw new BadRequestException('Missing organization id');
    }

    await this.entitlementsService.assert(organizationId, requiredEntitlement);

    return true;
  }
}
