import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import {
  SUBSCRIPTION_USD_REFERENCE_AMOUNT,
  type BillingCheckout,
  type Entitlement,
  type SubscriptionSummary,
} from '@churchflow/shared';
import { CurrencyRatesService } from '../currency-rates/currency-rates.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EntitlementsService } from './entitlements.service';
import { LiqPayService } from './liqpay.service';
import { SubscriptionsRepository } from './repositories/subscriptions.repository';
import {
  transitionForCallbackStatus,
  type SubscriptionTransitionState,
} from './subscription-transitions';

const BILLING_CURRENCY = 'UAH';
const BILLING_TIME_ZONE = 'Europe/Kyiv';
const NOTIFICATION_PREFERENCE_KEY = 'organizationUpdatesEnabled' as const;

type SubscriptionRecord = NonNullable<
  Awaited<ReturnType<SubscriptionsRepository['findByOrganizationId']>>
>;

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly entitlementsService: EntitlementsService,
    private readonly liqPayService: LiqPayService,
    private readonly currencyRatesService: CurrencyRatesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getSummary(organizationId: string): Promise<SubscriptionSummary> {
    const subscription = await this.requireSubscription(organizationId);
    const entitlements = await this.entitlementsService.listForOrganization(organizationId);

    return toSummary(subscription, entitlements);
  }

  /**
   * Binding a card and creating the subscription are one flow: this hands back the checkout
   * parameters, the payer enters the card on LiqPay, and the callback activates the
   * subscription. Card details never reach us.
   */
  async startCheckout(organizationId: string, actorUserId: string): Promise<BillingCheckout> {
    const subscription = await this.requireSubscription(organizationId);

    if (subscription.isExempt) {
      throw new ConflictException('This organization already has complimentary access');
    }

    // Replacing a card reuses this path. Cancelling the old LiqPay subscription before writing
    // the new order id is what stops an organization ending up billed twice.
    if (subscription.liqpayOrderId) {
      await this.liqPayService.unsubscribe(subscription.liqpayOrderId);
    }

    const now = new Date();
    const rates = await this.currencyRatesService.getCurrent(now);
    if (!rates) {
      throw new ServiceUnavailableException(
        'The exchange rate needed to price the subscription is unavailable',
      );
    }

    const amountMinor = Math.round(SUBSCRIPTION_USD_REFERENCE_AMOUNT * rates.usdToUah * 100);
    const orderId = randomUUID();

    await this.subscriptionsRepository.startSubscription({
      organizationId,
      actorUserId,
      orderId,
      amountMinor,
      currency: BILLING_CURRENCY,
      usdReference: SUBSCRIPTION_USD_REFERENCE_AMOUNT,
      fxRateUsedAt: now,
    });

    return this.liqPayService.buildSubscribeCheckout({
      orderId,
      amountMinor,
      currency: BILLING_CURRENCY,
      description: `ChurchFlow subscription - ${subscription.organization.name}`,
      now,
    });
  }

  async cancel(organizationId: string, actorUserId: string): Promise<SubscriptionSummary> {
    const subscription = await this.requireSubscription(organizationId);

    if (subscription.liqpayOrderId) {
      await this.liqPayService.unsubscribe(subscription.liqpayOrderId);
    }

    await this.subscriptionsRepository.cancel(organizationId, actorUserId);

    return this.getSummary(organizationId);
  }

  /**
   * Public, unauthenticated, and therefore trusted only after the signature checks out. Every
   * callback is persisted before it is acted on, and the unique (order_id, payment_id) index
   * makes a repeat delivery a no-op rather than a second state change.
   */
  async handleCallback(data: string, signature: string, now: Date = new Date()) {
    if (!this.liqPayService.verifySignature(data, signature)) {
      throw new ForbiddenException('LiqPay signature does not match');
    }

    const callback = this.liqPayService.decodeCallback(data);
    if (!callback?.orderId) {
      throw new BadRequestException('LiqPay callback is missing an order id');
    }

    // Without a payment id there is nothing to make the callback idempotent on, and silently
    // accepting it would mean a retry could apply the same charge twice.
    if (!callback.paymentId) {
      throw new BadRequestException('LiqPay callback is missing a payment id');
    }

    const subscription = await this.subscriptionsRepository.findByOrderId(callback.orderId);
    if (!subscription) {
      // Acknowledge anyway: retrying will not make an unknown order familiar.
      this.logger.warn({ event: 'LiqPay callback for unknown order', orderId: callback.orderId });

      return { ok: true as const };
    }

    const transition = transitionForCallbackStatus({
      current: subscription,
      callbackStatus: callback.status ?? '',
      now,
    });

    const { duplicate } = await this.subscriptionsRepository.applyCallback({
      subscriptionId: subscription.id,
      organizationId: subscription.organizationId,
      orderId: callback.orderId,
      paymentId: callback.paymentId,
      status: callback.status ?? 'unknown',
      previousStatus: subscription.status,
      nextStatus: transition?.status ?? null,
      payload: { data } satisfies Prisma.InputJsonObject,
      update: transition
        ? {
            status: transition.status,
            graceEndsAt: transition.graceEndsAt,
            currentPeriodEndsAt: transition.currentPeriodEndsAt,
            ...(transition.status === 'ACTIVE' ? { liqpaySubscribedAt: now } : {}),
            ...(callback.cardMask ? { cardMask: callback.cardMask } : {}),
            ...(callback.cardBrand ? { cardBrand: callback.cardBrand } : {}),
          }
        : null,
    });

    if (duplicate || !transition) {
      return { ok: true as const };
    }

    await this.notifyTransition(subscription, transition);

    return { ok: true as const };
  }

  private async notifyTransition(
    subscription: { organizationId: string; status: string },
    transition: SubscriptionTransitionState,
  ): Promise<void> {
    if (transition.status === 'ACTIVE' && transition.currentPeriodEndsAt) {
      await this.notifyOrganizationAdmins({
        organizationId: subscription.organizationId,
        type: 'SUBSCRIPTION_RENEWED',
        titleKey: 'subscriptionRenewed',
        bodyMessage: {
          key: 'subscriptionRenewed',
          nextChargeAt: transition.currentPeriodEndsAt.toISOString(),
          timeZone: BILLING_TIME_ZONE,
        },
        dedupeKey: `renewed:${dayKey(transition.currentPeriodEndsAt)}`,
      });

      return;
    }

    if (transition.status === 'PAST_DUE' && transition.graceEndsAt) {
      await this.notifyOrganizationAdmins({
        organizationId: subscription.organizationId,
        type: 'SUBSCRIPTION_PAYMENT_FAILED',
        titleKey: 'subscriptionPaymentFailed',
        bodyMessage: {
          key: 'subscriptionDeadline',
          deadline: transition.graceEndsAt.toISOString(),
          timeZone: BILLING_TIME_ZONE,
        },
        dedupeKey: `payment-failed:${dayKey(transition.graceEndsAt)}`,
      });
    }
  }

  /**
   * Delivery failures never fail billing. A church that cannot be emailed still had its payment
   * succeed, and the subscription state is what matters.
   */
  async notifyOrganizationAdmins(input: {
    organizationId: string;
    type:
      | 'SUBSCRIPTION_RENEWED'
      | 'SUBSCRIPTION_PAYMENT_FAILED'
      | 'SUBSCRIPTION_RESTRICTED'
      | 'SUBSCRIPTION_REQUIRED';
    titleKey:
      | 'subscriptionRenewed'
      | 'subscriptionPaymentFailed'
      | 'subscriptionRestricted'
      | 'subscriptionRequired';
    bodyMessage:
      | { key: 'subscriptionDeadline'; deadline: string; timeZone: string }
      | { key: 'subscriptionRenewed'; nextChargeAt: string; timeZone: string }
      | { key: 'subscriptionRestricted' };
    dedupeKey: string;
    recipientMembershipIds?: string[];
  }): Promise<void> {
    try {
      const recipientMembershipIds =
        input.recipientMembershipIds ??
        (await this.subscriptionsRepository.listAdminMembershipIds(input.organizationId)).map(
          (membership) => membership.id,
        );

      if (recipientMembershipIds.length === 0) {
        return;
      }

      await this.notificationsService.createSubscriptionNotifications({
        organizationId: input.organizationId,
        recipientMembershipIds,
        type: input.type,
        preferenceKey: NOTIFICATION_PREFERENCE_KEY,
        titleKey: input.titleKey,
        bodyMessage: input.bodyMessage,
        url: `/dashboard/${input.organizationId}`,
        entityType: 'Subscription',
        dedupeKey: input.dedupeKey,
        adminOnly: true,
      });
    } catch (error: unknown) {
      this.logger.warn({
        event: 'Subscription notification failed',
        organizationId: input.organizationId,
        type: input.type,
        message: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }

  private async requireSubscription(organizationId: string): Promise<SubscriptionRecord> {
    const subscription = await this.subscriptionsRepository.findByOrganizationId(organizationId);
    if (!subscription) {
      throw new NotFoundException('Organization was not found');
    }

    return subscription;
  }
}

function toSummary(
  subscription: SubscriptionRecord,
  entitlements: readonly Entitlement[],
): SubscriptionSummary {
  return {
    status: subscription.status,
    isExempt: subscription.isExempt,
    exemptReason: subscription.exemptReason,
    amountMinor: subscription.amountMinor,
    currency: subscription.currency,
    currentPeriodEndsAt: subscription.currentPeriodEndsAt?.toISOString() ?? null,
    restrictAfter: subscription.restrictAfter?.toISOString() ?? null,
    graceEndsAt: subscription.graceEndsAt?.toISOString() ?? null,
    card: subscription.cardMask
      ? { mask: subscription.cardMask, brand: subscription.cardBrand }
      : null,
    entitlements: [...entitlements],
  };
}
