import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Entitlement, hasEntitlement, resolveEntitlements } from '@churchflow/shared';
import { SubscriptionsRepository } from './repositories/subscriptions.repository';

@Injectable()
export class EntitlementsService {
  constructor(
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * The kill switch. Off in development and test so local work, and every request an
   * environment without LiqPay keys makes, is never restricted.
   */
  private isEnforcementEnabled(): boolean {
    return this.configService.getOrThrow<boolean>('BILLING_ENFORCEMENT_ENABLED');
  }

  async listForOrganization(
    organizationId: string,
    now: Date = new Date(),
  ): Promise<readonly Entitlement[]> {
    const subscription = await this.subscriptionsRepository.findEntitlementState(organizationId);

    return resolveEntitlements({
      subscription,
      now,
      enforcementEnabled: this.isEnforcementEnabled(),
    });
  }

  async has(
    organizationId: string,
    entitlement: Entitlement,
    now: Date = new Date(),
  ): Promise<boolean> {
    const granted = await this.listForOrganization(organizationId, now);

    return hasEntitlement(granted, entitlement);
  }
}
