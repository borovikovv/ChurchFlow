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
  BILLING_CHECKOUT_REUSE_MINUTES,
  SUBSCRIPTION_USD_REFERENCE_AMOUNT,
  type BillingCheckout,
  type Entitlement,
  type SubscriptionSummary,
} from '@churchflow/shared';
import { CurrencyRatesService } from '../currency-rates/currency-rates.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EntitlementsService } from './entitlements.service';
import { LiqPayService, type LiqPayCallback } from './liqpay.service';
import {
  StaleSubscriptionStateError,
  SubscriptionsRepository,
  type CheckoutResolution,
  type SubscriptionOrderMatch,
} from './repositories/subscriptions.repository';
import { BILLING_TIME_ZONE, dayKey, minutesAgo } from './billing-time';
import {
  callbackRole,
  classifyCallbackStatus,
  transitionForCallbackStatus,
  type CallbackOutcome,
  type CallbackRole,
  type SubscriptionTransitionState,
} from './subscription-transitions';

const BILLING_CURRENCY = 'UAH';

// A callback is decided against state read before the transaction that writes it. A concurrent
// change invalidates that reading rather than being overwritten, and the decision is made again.
// More than a couple of collisions on one subscription is not contention, it is a bug.
const CALLBACK_APPLY_ATTEMPTS = 3;
const NOTIFICATION_PREFERENCE_KEY = 'organizationUpdatesEnabled' as const;

type SubscriptionRecord = NonNullable<
  Awaited<ReturnType<SubscriptionsRepository['findByOrganizationId']>>
>;
type CheckoutOrderRecord = NonNullable<SubscriptionOrderMatch['checkoutOrder']>;

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

    const now = new Date();
    const rates = await this.currencyRatesService.getCurrent(now);
    if (!rates) {
      throw new ServiceUnavailableException(
        'The exchange rate needed to price the subscription is unavailable',
      );
    }

    const amountMinor = Math.round(SUBSCRIPTION_USD_REFERENCE_AMOUNT * rates.usdToUah * 100);

    // A checkout already offered at this price is handed back rather than replaced. Two clicks
    // seconds apart are one intent, and a second order would be a second payable LiqPay page.
    const reusable = await this.subscriptionsRepository.findReusableCheckout({
      subscriptionId: subscription.id,
      amountMinor,
      createdAfter: minutesAgo(now, BILLING_CHECKOUT_REUSE_MINUTES),
    });
    const orderId = reusable?.orderId ?? randomUUID();

    // Nothing about the live subscription changes here. Replacing a card goes through the same
    // path, and cancelling the old order before the new one is paid for would leave an
    // organization that closes the LiqPay tab with no subscription and nothing charging it.
    if (!reusable) {
      await this.subscriptionsRepository.createCheckoutOrder({
        organizationId,
        subscriptionId: subscription.id,
        actorUserId,
        orderId,
        amountMinor,
        currency: BILLING_CURRENCY,
        usdReference: SUBSCRIPTION_USD_REFERENCE_AMOUNT,
        fxRateUsedAt: now,
      });
    }

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

    // A refused or unreachable unsubscribe is remembered, not swallowed: otherwise the card
    // keeps being charged every month behind a subscription we are showing as cancelled. Only an
    // undecided answer leaves the order queued - an order LiqPay has no recurring charge for is
    // as stopped as one it just cancelled, and requeueing it would retry it nightly forever.
    const unsubscribe = subscription.liqpayOrderId
      ? {
          orderId: subscription.liqpayOrderId,
          stopped: (await this.liqPayService.unsubscribe(subscription.liqpayOrderId)) !== 'retry',
        }
      : null;

    await this.subscriptionsRepository.cancel(organizationId, actorUserId, unsubscribe);

    return this.getSummary(organizationId);
  }

  /**
   * Public, unauthenticated, and therefore trusted only after the signature checks out. Every
   * callback is persisted before it is acted on, and the unique (order_id, payment_id, status)
   * index makes a repeat delivery a no-op rather than a second state change.
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

    const orderId = callback.orderId;
    const paymentId = callback.paymentId;

    // The unique index makes one callback delivered twice harmless. It says nothing about two
    // different payments arriving at once, which is what this loop is for: the write refuses
    // state that moved under it, and the decision is then made again on what the row now holds.
    for (let attempt = 1; attempt <= CALLBACK_APPLY_ATTEMPTS; attempt += 1) {
      try {
        return await this.applyCallbackOnce({ data, callback, orderId, paymentId, now });
      } catch (error: unknown) {
        if (
          !(error instanceof StaleSubscriptionStateError) ||
          attempt === CALLBACK_APPLY_ATTEMPTS
        ) {
          throw error;
        }

        this.logger.warn({
          event: 'LiqPay callback raced another change and is being reapplied',
          orderId,
          attempt,
        });
      }
    }

    // Unreachable: the loop returns or throws. Better a 500 LiqPay redelivers than a silent 200.
    throw new ServiceUnavailableException('The callback could not be applied');
  }

  private async applyCallbackOnce(input: {
    data: string;
    callback: LiqPayCallback;
    orderId: string;
    paymentId: string;
    now: Date;
  }): Promise<{ ok: true }> {
    const { data, callback, orderId, paymentId, now } = input;

    const match = await this.subscriptionsRepository.findByOrderId(orderId);
    if (!match) {
      // Acknowledge anyway: retrying will not make an unknown order familiar.
      this.logger.warn({ event: 'LiqPay callback for unknown order', orderId });

      return { ok: true as const };
    }

    const { subscription, checkoutOrder } = match;

    const role = callbackRole({
      checkoutStatus: checkoutOrder?.status ?? null,
      isLiveOrder: subscription.liqpayOrderId === orderId,
    });
    const isNewSubscription = role === 'new-checkout';
    const outcome = classifyCallbackStatus(callback.status ?? '');

    if (checkoutOrder) {
      this.warnOnAmountMismatch(checkoutOrder, callback);
    }

    // A retired order decides nothing about the subscription whatever it reports: it was
    // abandoned, or it has already been replaced by the order that is live now. Letting one
    // through is how a tab left open on a cancelled subscription revives it, and how last
    // month's order takes the live one's place when its own renewal lands late.
    const transition =
      role === 'retired-checkout'
        ? null
        : transitionForCallbackStatus({
            current: subscription,
            callbackStatus: callback.status ?? '',
            now,
            isNewSubscription,
          });

    const unsubscribeOrderId = orderToStop({
      role,
      outcome,
      orderId,
      liveOrderId: subscription.liqpayOrderId,
      activated: transition?.status === 'ACTIVE',
    });

    const { duplicate } = await this.subscriptionsRepository.applyCallback({
      subscriptionId: subscription.id,
      organizationId: subscription.organizationId,
      orderId,
      paymentId,
      status: callback.status ?? 'unknown',
      previousStatus: subscription.status,
      nextStatus: transition?.status ?? null,
      // The state this callback was judged against. The write applies only while the row still
      // holds it, so a payment decided against a subscription that has since moved on is redone
      // rather than layered on top of someone else's change.
      expectedLiqpayOrderId: subscription.liqpayOrderId,
      payload: { data } satisfies Prisma.InputJsonObject,
      update: transition
        ? this.buildCallbackUpdate({
            checkoutOrder,
            transition,
            callback,
            orderId,
            isNewSubscription,
            now,
          })
        : null,
      // Queued in the same transaction as the swap: an order superseded but never queued is an
      // order still charging the card, with nothing left that knows to stop it.
      unsubscribeOrderId,
      checkout: resolveCheckout({
        checkoutOrder,
        outcome,
        isNewSubscription,
        activated: transition?.status === 'ACTIVE',
      }),
    });

    if (duplicate) {
      return { ok: true as const };
    }

    if (unsubscribeOrderId) {
      await this.stopOrder(unsubscribeOrderId);
    }

    if (transition) {
      await this.notifyTransition(subscription, transition);
    }

    return { ok: true as const };
  }

  private buildCallbackUpdate(input: {
    checkoutOrder: CheckoutOrderRecord | null;
    transition: SubscriptionTransitionState;
    callback: LiqPayCallback;
    orderId: string;
    isNewSubscription: boolean;
    now: Date;
  }): Prisma.SubscriptionUpdateManyMutationInput {
    const { transition, callback, isNewSubscription, now } = input;
    const update: Prisma.SubscriptionUpdateManyMutationInput = {
      status: transition.status,
      graceEndsAt: transition.graceEndsAt,
      currentPeriodEndsAt: transition.currentPeriodEndsAt,
      ...(callback.cardMask ? { cardMask: callback.cardMask } : {}),
      ...(callback.cardBrand ? { cardBrand: callback.cardBrand } : {}),
    };

    if (transition.status !== 'ACTIVE') {
      return update;
    }

    if (!isNewSubscription || !input.checkoutOrder) {
      return { ...update, liqpaySubscribedAt: now };
    }

    // The checkout has been paid for, so it becomes the live subscription. The price comes from
    // the order that was actually paid rather than from whatever checkout was offered last, and
    // the order it replaces is queued for cancellation rather than cancelled hopefully in
    // advance.
    return {
      ...update,
      liqpaySubscribedAt: now,
      liqpayOrderId: input.orderId,
      amountMinor: input.checkoutOrder.amountMinor,
      currency: input.checkoutOrder.currency,
      usdReference: input.checkoutOrder.usdReference,
      fxRateUsedAt: input.checkoutOrder.fxRateUsedAt,
    };
  }

  /**
   * The pinned price is the one that counts, so a disagreeing callback is reported rather than
   * adopted: letting the amount on the row follow whatever arrives would erase the only record
   * of what the organization agreed to pay.
   */
  private warnOnAmountMismatch(order: CheckoutOrderRecord, callback: LiqPayCallback): void {
    if (callback.amountMinor === null) {
      return;
    }

    const currencyMatches = callback.currency === null || callback.currency === order.currency;
    if (callback.amountMinor === order.amountMinor && currencyMatches) {
      return;
    }

    this.logger.warn({
      event: 'LiqPay callback amount does not match the pinned price',
      orderId: order.orderId,
      pinnedAmountMinor: order.amountMinor,
      pinnedCurrency: order.currency,
      callbackAmountMinor: callback.amountMinor,
      callbackCurrency: callback.currency,
    });
  }

  /** Best effort now, retried by the dunning job for as long as the request is still open. */
  async stopOrder(orderId: string): Promise<boolean> {
    if ((await this.liqPayService.unsubscribe(orderId)) === 'retry') {
      return false;
    }

    await this.subscriptionsRepository.resolveUnsubscribeRequest(orderId);

    return true;
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
      | 'SUBSCRIPTION_REQUIRED'
      | 'SUBSCRIPTION_CANCELED';
    titleKey:
      | 'subscriptionRenewed'
      | 'subscriptionPaymentFailed'
      | 'subscriptionRestricted'
      | 'subscriptionRequired'
      | 'subscriptionCanceled';
    bodyMessage:
      | { key: 'subscriptionDeadline'; deadline: string; timeZone: string }
      | { key: 'subscriptionRenewed'; nextChargeAt: string; timeZone: string }
      | { key: 'subscriptionRestricted' }
      | { key: 'subscriptionCanceledComplimentary' };
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

/**
 * The order this callback leaves charging a card, if any. Only one order may bill an organization
 * at a time, so whichever of them is not the live one has to be stopped - and an order missed
 * here is an order LiqPay keeps charging with nothing left in the system aware of it.
 */
function orderToStop(input: {
  role: CallbackRole;
  outcome: CallbackOutcome;
  orderId: string;
  liveOrderId: string | null;
  activated: boolean;
}): string | null {
  const { role, outcome, orderId, liveOrderId, activated } = input;

  // Paid, for an order we are not honouring. The money was taken and LiqPay now holds a recurring
  // charge nothing else tracks, so the order is queued against itself rather than ignored.
  if (role === 'retired-checkout') {
    return outcome === 'paid' ? orderId : null;
  }

  if (role === 'new-checkout' && activated && liveOrderId && liveOrderId !== orderId) {
    return liveOrderId;
  }

  return null;
}

/**
 * Which checkout order a callback closes, if any. Only a decided callback closes one: an
 * undecided `wait_*` may still turn into a payment, and retiring its order early would leave that
 * payment matching nothing - the failure this table exists to prevent.
 */
function resolveCheckout(input: {
  checkoutOrder: CheckoutOrderRecord | null;
  outcome: CallbackOutcome;
  isNewSubscription: boolean;
  activated: boolean;
}): CheckoutResolution | null {
  const { checkoutOrder, outcome, isNewSubscription, activated } = input;

  if (!checkoutOrder || !isNewSubscription || outcome === 'undecided') {
    return null;
  }

  if (outcome === 'paid') {
    return activated ? { id: checkoutOrder.id, outcome: 'paid' } : null;
  }

  return { id: checkoutOrder.id, outcome: 'abandoned' };
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
    // A live LiqPay order, whatever the organization's access looks like. Reading this off the
    // status instead is what hid the button from a restricted organization whose card was still
    // being charged every month.
    canCancel: subscription.liqpayOrderId !== null && subscription.status !== 'CANCELED',
    entitlements: [...entitlements],
  };
}
