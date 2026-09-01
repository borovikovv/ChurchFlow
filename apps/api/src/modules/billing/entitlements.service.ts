import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ORGANIZATION_RESTRICTED_ERROR_CODE,
  type Entitlement,
  type SubscriptionEntitlementState,
  hasEntitlement,
  resolveEntitlements,
} from '@churchflow/shared';
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

    return this.resolve(subscription, now);
  }

  /**
   * For callers that already hold the subscription row. Listing an account's organizations would
   * otherwise cost one subscription query per organization to answer the same question.
   */
  resolve(
    subscription: SubscriptionEntitlementState | null,
    now: Date = new Date(),
  ): readonly Entitlement[] {
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

  /**
   * Refuses the action when the subscription does not cover it. The message is written for
   * both audiences at once: an owner reads "subscribe", a platform admin reads "ask for
   * complimentary access", so neither is left staring at a bare 403.
   */
  async assert(
    organizationId: string,
    entitlement: Entitlement,
    now: Date = new Date(),
  ): Promise<void> {
    if (await this.has(organizationId, entitlement, now)) {
      return;
    }

    throw new ForbiddenException({
      code: ORGANIZATION_RESTRICTED_ERROR_CODE,
      message:
        'This organization is restricted because it has no active subscription. Subscribe, or ask a platform administrator to grant complimentary access.',
    });
  }
}
