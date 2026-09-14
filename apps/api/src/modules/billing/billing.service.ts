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
  cancellationTransition,
  canRequestCancellation,
  classifyCallbackStatus,
  isOutOfOrderCallback,
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
const OUT_OF_ORDER_ISSUE = 'out-of-order-callback';
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

    if (!canRequestCancellation(subscription)) return this.getSummary(organizationId);

    const canceled = await this.subscriptionsRepository
      .cancel({
        organizationId,
        actorUserId,
        expectedUpdatedAt: subscription.updatedAt,
        data: cancellationTransition(subscription, new Date()),
        unsubscribeOrderId: subscription.liqpayOrderId,
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new ConflictException('The subscription changed. Please try canceling again.');
        }
        throw error;
      });
    await this.notifyOrganizationAdmins({
      organizationId,
      type: 'SUBSCRIPTION_CANCELED',
      titleKey: 'subscriptionCancellationRequested',
      bodyMessage: {
        key: 'subscriptionCancellationRequested',
        deadline: canceled.graceEndsAt?.toISOString() ?? null,
        timeZone: BILLING_TIME_ZONE,
      },
      dedupeKey: `cancellation:${canceled.cancelRequestedAt?.toISOString() ?? 'none'}`,
    });
    if (subscription.liqpayOrderId) await this.stopOrder(subscription.liqpayOrderId);
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
    const callbackPaymentId =
      callback.paymentId ?? (callback.status === 'unsubscribed' ? 'unsubscribe' : null);
    if (!callbackPaymentId) {
      throw new BadRequestException('LiqPay callback is missing a payment id');
    }

    return this.applyCallbackWithRetries({
      payload: { data },
      callback,
      orderId: callback.orderId,
      paymentId: callbackPaymentId,
      now,
    });
  }

  /**
   * A renewal LiqPay never reported. Asking it directly is the only way to tell a payment that
   * genuinely failed from a callback that was lost on the way, and the answer is applied through
   * exactly the path a callback takes - so the credit index still makes a later delivery of the
   * same payment a no-op rather than a second month.
   *
   * Only a paid answer is acted on. Anything else, an unreachable provider included, leaves the
   * subscription exactly where the missing callback left it: a provider we cannot read must never
   * be the reason an organization is put into arrears.
   */
  async reconcileOrderWithProvider(orderId: string, now: Date = new Date()): Promise<boolean> {
    const status = await this.liqPayService.queryOrderStatus(orderId);
    if (!status || classifyCallbackStatus(status.status) !== 'paid') {
      return false;
    }

    // Without a payment id there is nothing to be idempotent on, and a nightly job that credits
    // the same charge again every night is worse than one that credits nothing at all.
    if (!status.paymentId) {
      this.logger.warn({ event: 'LiqPay reported a paid order with no payment id', orderId });

      return false;
    }

    try {
      await this.applyCallbackWithRetries({
        payload: { source: 'liqpay-status', status: status.status },
        callback: {
          action: 'status',
          status: status.status,
          orderId,
          paymentId: status.paymentId,
          amountMinor: status.amountMinor,
          currency: status.currency,
          cardMask: status.cardMask,
          cardBrand: status.cardBrand,
          eventAt: status.eventAt,
        },
        orderId,
        paymentId: status.paymentId,
        now,
      });

      return true;
    } catch (error: unknown) {
      // Same reasoning as stopOrder: this runs over a batch, and one subscription that cannot be
      // settled must not take the rest of the nightly pass down with it.
      this.logger.warn({
        event: 'Reconciling an order against LiqPay failed',
        orderId,
        message: error instanceof Error ? error.message : 'unknown error',
      });

      return false;
    }
  }

  /**
   * The unique index makes one callback delivered twice harmless. It says nothing about two
   * different payments arriving at once, which is what this loop is for: the write refuses state
   * that moved under it, and the decision is then made again on what the row now holds.
   */
  private async applyCallbackWithRetries(input: {
    payload: Prisma.InputJsonObject;
    callback: LiqPayCallback;
    orderId: string;
    paymentId: string;
    now: Date;
  }): Promise<{ ok: true }> {
    for (let attempt = 1; attempt <= CALLBACK_APPLY_ATTEMPTS; attempt += 1) {
      try {
        return await this.applyCallbackOnce(input);
      } catch (error: unknown) {
        if (
          !(error instanceof StaleSubscriptionStateError) ||
          attempt === CALLBACK_APPLY_ATTEMPTS
        ) {
          throw error;
        }

        this.logger.warn({
          event: 'LiqPay callback raced another change and is being reapplied',
          orderId: input.orderId,
          attempt,
        });
      }
    }

    // Unreachable: the loop returns or throws. Better a 500 LiqPay redelivers than a silent 200.
    throw new ServiceUnavailableException('The callback could not be applied');
  }

  private async applyCallbackOnce(input: {
    payload: Prisma.InputJsonObject;
    callback: LiqPayCallback;
    orderId: string;
    paymentId: string;
    now: Date;
  }): Promise<{ ok: true }> {
    const { payload, callback, orderId, paymentId, now } = input;

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

    const review = paymentReview(
      callback,
      checkoutOrder ?? subscription,
      role,
      outcome,
      this.liqPayService,
    );
    const blocked = review?.blocks ?? false;

    // Everything above judges the callback against the subscription as it stands now, which is
    // only sound while callbacks arrive in the order their events happened. LiqPay does not
    // promise that, so a callback overtaken by one already applied is recorded and acted on by
    // nothing: it is history, not news.
    const history = await this.subscriptionsRepository.findPaymentHistory({
      subscriptionId: subscription.id,
      orderId,
      paymentId,
    });
    const outOfOrder = isOutOfOrderCallback({
      outcome,
      eventAt: callback.eventAt,
      lastEventAt: history.lastEventAt,
      paymentAlreadyFailed: history.paymentAlreadyFailed,
    });
    const issue = review?.issue ?? (outOfOrder ? OUT_OF_ORDER_ISSUE : null);

    // A retired order decides nothing about the subscription whatever it reports: it was
    // abandoned, or it has already been replaced by the order that is live now. Letting one
    // through is how a tab left open on a cancelled subscription revives it, and how last
    // month's order takes the live one's place when its own renewal lands late.
    const transition =
      blocked || outOfOrder || role === 'retired-checkout'
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
      blocked,
      orderId,
      liveOrderId: subscription.liqpayOrderId,
      activated: transition?.status === 'ACTIVE',
      cancellationPending:
        !isNewSubscription &&
        Boolean(subscription.cancelRequestedAt || subscription.status === 'CANCELED'),
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
      expectedCancelRequestedAt: subscription.cancelRequestedAt,
      expectedUpdatedAt: subscription.updatedAt,
      credited: outcome === 'paid' && transition !== null,
      issue,
      eventAt: callback.eventAt,
      payload,
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
      // Only a cancellation this callback recorded closes the checkouts still open. Reading it
      // off the update instead abandons a re-subscribe checkout every time a late charge lands on
      // the old order, since that update carries the cancellation forward untouched.
      abandonOpenCheckouts: outcome === 'canceled' && transition !== null,
      checkout:
        blocked && checkoutOrder?.status === 'PROPOSED'
          ? { id: checkoutOrder.id, outcome: 'abandoned' }
          : resolveCheckout({
              checkoutOrder,
              outcome,
              isNewSubscription,
              activated: transition?.status === 'ACTIVE',
            }),
    });

    if (duplicate) {
      return { ok: true as const };
    }

    if (outOfOrder) {
      this.logger.warn({
        event: 'LiqPay callback was overtaken by one already applied and changed nothing',
        orderId,
        paymentId,
        status: callback.status,
        organizationId: subscription.organizationId,
      });
    }

    if (review) {
      const context = {
        issue: review.issue,
        orderId,
        paymentId,
        organizationId: subscription.organizationId,
      };

      // A price we cannot check is a gap in what we stored, not a suspicious charge. It is worth
      // knowing about, but telling an organization its successful payment needs review - or
      // withholding the access it just paid for - would be our bookkeeping made into their
      // problem.
      if (!review.blocks) {
        this.logger.warn({ event: 'Billing payment could not be price-checked', ...context });
      } else {
        this.logger.error({ event: 'Billing payment requires review', ...context });
        await this.notifyOrganizationAdmins({
          organizationId: subscription.organizationId,
          type: 'SUBSCRIPTION_PAYMENT_FAILED',
          titleKey: 'subscriptionPaymentReview',
          bodyMessage: { key: 'subscriptionPaymentReview' },
          dedupeKey: `payment-review:${orderId}:${paymentId}`,
        });
      }
    }
    if (outcome === 'canceled' && subscription.cancelRequestedAt && role === 'renewal') {
      await this.notifyOrganizationAdmins({
        organizationId: subscription.organizationId,
        type: 'SUBSCRIPTION_CANCELED',
        titleKey: 'subscriptionCancellationConfirmed',
        bodyMessage: { key: 'subscriptionCancellationConfirmed' },
        dedupeKey: `cancellation-confirmed:${orderId}`,
      });
    }
    if (transition) {
      await this.notifyTransition(subscription, transition);
    }
    if (unsubscribeOrderId) await this.stopOrder(unsubscribeOrderId);

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
      cancelRequestedAt: transition.cancelRequestedAt ?? null,
      ...(callback.cardMask ? { cardMask: callback.cardMask } : {}),
      ...(callback.cardBrand ? { cardBrand: callback.cardBrand } : {}),
    };

    if (transition.cancelRequestedAt || transition.status !== 'ACTIVE') {
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

  /** Best effort now, retried by the dunning job for as long as the request is still open. */
  async stopOrder(orderId: string): Promise<boolean> {
    try {
      if ((await this.liqPayService.unsubscribe(orderId)) === 'retry') {
        return false;
      }

      await this.subscriptionsRepository.resolveUnsubscribeRequest(orderId);

      return true;
    } catch (error: unknown) {
      // Every caller has already committed the change this call follows. Failing over it would
      // report a cancellation that did happen as one that did not, and abandon the rest of the
      // retry batch besides. The request stays open, which is what gets the order stopped.
      this.logger.warn({
        event: 'Stopping a LiqPay order failed',
        orderId,
        message: error instanceof Error ? error.message : 'unknown error',
      });

      return false;
    }
  }

  private async notifyTransition(
    subscription: {
      organizationId: string;
      status: string;
      cancelRequestedAt: Date | null;
      graceEndsAt: Date | null;
    },
    transition: SubscriptionTransitionState,
  ): Promise<void> {
    if (transition.cancelRequestedAt) {
      // The deadline moved in rather than out, so a payment was taken back rather than received.
      // "Your payment has been credited" is the one thing this must not say.
      if (
        subscription.graceEndsAt &&
        transition.graceEndsAt &&
        transition.graceEndsAt < subscription.graceEndsAt
      ) {
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
        return;
      }

      // Nothing was cancelled before this callback arrived, so there is no earlier request for it
      // to be an update to: LiqPay stopping the subscription on its own is the request.
      const firstRequest = subscription.cancelRequestedAt === null;
      const deadline = transition.graceEndsAt?.toISOString() ?? null;
      await this.notifyOrganizationAdmins({
        organizationId: subscription.organizationId,
        type: 'SUBSCRIPTION_CANCELED',
        titleKey: firstRequest
          ? 'subscriptionCancellationRequested'
          : 'subscriptionCancellationUpdated',
        bodyMessage: {
          key: firstRequest
            ? 'subscriptionCancellationRequested'
            : 'subscriptionCancellationUpdated',
          deadline,
          timeZone: BILLING_TIME_ZONE,
        },
        dedupeKey: firstRequest
          ? `cancellation:${transition.cancelRequestedAt.toISOString()}`
          : `cancellation-updated:${transition.cancelRequestedAt.toISOString()}:${deadline ?? 'none'}`,
      });
      return;
    }

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
      | 'subscriptionCanceled'
      | 'subscriptionCancellationRequested'
      | 'subscriptionCancellationUpdated'
      | 'subscriptionCancellationConfirmed'
      | 'subscriptionCancellationEnded'
      | 'subscriptionPaymentReview';
    bodyMessage:
      | { key: 'subscriptionDeadline'; deadline: string; timeZone: string }
      | { key: 'subscriptionRenewed'; nextChargeAt: string; timeZone: string }
      | { key: 'subscriptionRestricted' }
      | { key: 'subscriptionCanceledComplimentary' }
      | {
          key: 'subscriptionCancellationRequested' | 'subscriptionCancellationUpdated';
          deadline: string | null;
          timeZone: string;
        }
      | {
          key:
            | 'subscriptionCancellationEnded'
            | 'subscriptionCancellationConfirmed'
            | 'subscriptionPaymentReview';
        };
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
  blocked: boolean;
  orderId: string;
  liveOrderId: string | null;
  activated: boolean;
  /** The subscription was already being wound down before this callback arrived. */
  cancellationPending: boolean;
}): string | null {
  const { role, outcome, blocked, orderId, liveOrderId, activated, cancellationPending } = input;

  if (outcome !== 'paid') {
    return null;
  }

  // Paid, for an order we are not honouring - abandoned, superseded, or charging a subscription
  // the organization has already asked to stop. The money was taken and LiqPay now holds a
  // recurring charge nothing else tracks, so the order is queued against itself rather than
  // ignored.
  if (role === 'retired-checkout' || cancellationPending) {
    return orderId;
  }

  // A payment held back for review still leaves its order charging, but only a checkout we are
  // refusing to honour may be stopped over it. Declining to credit a renewal is doubt about one
  // charge, never grounds for cancelling the payer's live recurring order on their behalf.
  if (blocked) {
    return role === 'new-checkout' ? orderId : null;
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
    cancelRequestedAt: subscription.cancelRequestedAt?.toISOString() ?? null,
    cancellationPending: Boolean(
      subscription.cancelRequestedAt &&
      subscription.unsubscribeRequests.some(
        (request) => request.orderId === subscription.liqpayOrderId,
      ),
    ),
    previousCancellationPending: subscription.unsubscribeRequests.some(
      (request) => request.orderId !== subscription.liqpayOrderId,
    ),
    restrictAfter: subscription.restrictAfter?.toISOString() ?? null,
    graceEndsAt: subscription.graceEndsAt?.toISOString() ?? null,
    card: subscription.cardMask
      ? { mask: subscription.cardMask, brand: subscription.cardBrand }
      : null,
    // A live LiqPay order, whatever the organization's access looks like. Reading this off the
    // status instead is what hid the button from a restricted organization whose card was still
    // being charged every month.
    canCancel: canRequestCancellation(subscription),
    entitlements: [...entitlements],
  };
}

interface PaymentReview {
  issue: string;
  /**
   * Whether the payment may still be credited. Two known sums that disagree is a charge we refuse
   * to honour. A sum we never pinned - a subscription activated before checkout orders existed,
   * or a callback LiqPay sent without one - is a gap on our side, and the signature has already
   * proven the callback genuine, so it is recorded and reported rather than held against the payer.
   */
  blocks: boolean;
}

function paymentReview(
  callback: LiqPayCallback,
  price: { amountMinor: number | null; currency: string | null },
  role: CallbackRole,
  outcome: CallbackOutcome,
  liqPayService: LiqPayService,
): PaymentReview | null {
  if (outcome !== 'paid') return null;
  if (callback.status === 'sandbox' && !liqPayService.isSandbox()) {
    return { issue: 'unexpected-sandbox', blocks: true };
  }

  const comparable =
    price.amountMinor !== null &&
    price.amountMinor > 0 &&
    price.currency !== null &&
    callback.amountMinor !== null &&
    callback.currency !== null;

  if (
    comparable &&
    (callback.amountMinor !== price.amountMinor || callback.currency !== price.currency)
  ) {
    return { issue: 'payment-price-mismatch', blocks: true };
  }
  if (role === 'retired-checkout') {
    return { issue: 'retired-order-payment', blocks: true };
  }
  if (!comparable) {
    return { issue: 'unverifiable-price', blocks: false };
  }

  return null;
}
