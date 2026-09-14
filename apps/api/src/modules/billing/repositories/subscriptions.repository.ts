import { Injectable } from '@nestjs/common';
import { Prisma, type SubscriptionStatus } from '@churchflow/db';
import type { SubscriptionEntitlementState } from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { queueUnsubscribe, resolveUnsubscribe } from '../billing-unsubscribe-queue';
import { FAILED_CALLBACK_STATUSES } from '../subscription-transitions';

// Who hears about billing: the same people who are allowed to pay.
const ADMIN_MEMBERS_SELECT = {
  members: {
    where: {
      role: { in: ['OWNER', 'ADMIN'] },
      status: 'ACTIVE',
      removedAt: null,
      userId: { not: null },
    },
    select: { id: true },
  },
} satisfies Prisma.OrganizationSelect;

/** A cancellation whose paid access and grace period have both run out. */
const cancellationDue = (now: Date) =>
  ({
    cancelRequestedAt: { not: null },
    status: { not: 'CANCELED' },
    graceEndsAt: { lte: now },
  }) satisfies Prisma.SubscriptionWhereInput;

/** An unpaid subscription whose rollout window or grace period has run out. */
const restrictionDue = (now: Date) =>
  [
    { status: 'PENDING', restrictAfter: { lte: now } },
    { status: 'PAST_DUE', graceEndsAt: { lte: now } },
  ] satisfies Prisma.SubscriptionWhereInput[];

type SubscriptionRow = Prisma.SubscriptionGetPayload<Record<string, never>>;
type CheckoutOrderRow = Prisma.BillingCheckoutOrderGetPayload<Record<string, never>>;

export interface SubscriptionOrderMatch {
  subscription: SubscriptionRow;
  /** Null when the callback belongs to an order LiqPay charges directly, not to a checkout. */
  checkoutOrder: CheckoutOrderRow | null;
}

/** How a callback closes the checkout order it arrived for, if it closes it at all. */
export interface CheckoutResolution {
  id: string;
  outcome: 'paid' | 'abandoned';
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * The subscription moved between being read and being written, so the change computed from that
 * reading no longer describes it. Raised rather than swallowed: the caller has to decide again on
 * the current state, and applying the stale change would overwrite whatever moved it.
 */
export class StaleSubscriptionStateError extends Error {
  constructor(readonly subscriptionId: string) {
    super('Subscription state changed while the callback was being applied');
    this.name = 'StaleSubscriptionStateError';
  }
}

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findEntitlementState(organizationId: string): Promise<SubscriptionEntitlementState | null> {
    return this.prisma.subscription.findUnique({
      where: { organizationId },
      select: {
        status: true,
        isExempt: true,
        restrictAfter: true,
        graceEndsAt: true,
        cancelRequestedAt: true,
      },
    });
  }

  findByOrganizationId(organizationId: string) {
    return this.prisma.subscription.findUnique({
      where: { organizationId },
      include: {
        organization: { select: { id: true, name: true } },
        unsubscribeRequests: { where: { resolvedAt: null }, select: { orderId: true } },
      },
    });
  }

  /**
   * Resolves a callback to the subscription it belongs to. Every order ever offered has a row of
   * its own, so a payment for a checkout that has since been superseded still finds its way home
   * instead of being logged as unknown and dropped.
   */
  async findByOrderId(orderId: string): Promise<SubscriptionOrderMatch | null> {
    const checkoutOrder = await this.prisma.billingCheckoutOrder.findUnique({
      where: { orderId },
      include: { subscription: true },
    });

    if (checkoutOrder) {
      const { subscription, ...order } = checkoutOrder;

      return { subscription, checkoutOrder: order };
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { liqpayOrderId: orderId },
    });

    return subscription ? { subscription, checkoutOrder: null } : null;
  }

  /**
   * The checkout already offered for this exact price, if it is recent enough to still be the
   * same intent. Reusing it is what keeps a double click from minting a second LiqPay order that
   * can be paid independently of the first.
   */
  findReusableCheckout(input: { subscriptionId: string; amountMinor: number; createdAfter: Date }) {
    return this.prisma.billingCheckoutOrder.findFirst({
      where: {
        subscriptionId: input.subscriptionId,
        status: 'PROPOSED',
        amountMinor: input.amountMinor,
        createdAt: { gte: input.createdAfter },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Records an offered checkout without touching the live subscription. Nothing here changes
   * what the organization is charged or whether it keeps access: an abandoned LiqPay page must
   * cost the church nothing, so the swap happens only when a payment actually succeeds.
   *
   * The price is pinned per order rather than on the subscription. LiqPay fixes amount and
   * currency when the subscription is created, and the order that gets paid is the one whose
   * price becomes live - which is not always the one offered last.
   */
  createCheckoutOrder(input: {
    organizationId: string;
    subscriptionId: string;
    actorUserId: string;
    orderId: string;
    amountMinor: number;
    currency: string;
    usdReference: number;
    fxRateUsedAt: Date;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const checkoutOrder = await tx.billingCheckoutOrder.create({
        data: {
          organizationId: input.organizationId,
          subscriptionId: input.subscriptionId,
          orderId: input.orderId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          usdReference: input.usdReference,
          fxRateUsedAt: input.fxRateUsedAt,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'START_SUBSCRIPTION',
          entityType: 'Subscription',
          entityId: input.subscriptionId,
          metadata: { amountMinor: input.amountMinor, orderId: input.orderId },
        },
      });

      return checkoutOrder;
    });
  }

  /**
   * Records the callback and applies its state change in one transaction. A redelivery of the
   * same callback is stopped by the unique (order_id, payment_id, status) index rather than by a
   * read-then-write check; two callbacks for *different* payments are stopped by the state guard
   * on the update, which refuses a change computed from a reading that no longer holds.
   *
   * What the callback is worth deciding nothing about is decided by the caller: whether the
   * payment may be credited, which order it leaves charging, and whether it is the cancellation
   * that closes the checkouts still open.
   */
  async applyCallback(input: {
    subscriptionId: string;
    organizationId: string;
    orderId: string;
    paymentId: string;
    status: string;
    previousStatus: SubscriptionStatus;
    nextStatus: string | null;
    /** The live order the decision was made against, guarding the write against a racing one. */
    expectedLiqpayOrderId: string | null;
    expectedCancelRequestedAt: Date | null;
    expectedUpdatedAt: Date;
    credited: boolean;
    issue: string | null;
    /** When LiqPay says this happened, kept so later callbacks can be ordered against it. */
    eventAt: Date | null;
    payload: Prisma.InputJsonObject;
    update: Prisma.SubscriptionUpdateManyMutationInput | null;
    checkout: CheckoutResolution | null;
    /** An order this callback supersedes, queued for LiqPay to stop charging. */
    unsubscribeOrderId: string | null;
    /** True only when this callback is what recorded the cancellation. */
    abandonOpenCheckouts: boolean;
  }): Promise<{ duplicate: boolean }> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const resolvedAt = new Date();

        await tx.billingCallback.create({
          data: {
            organizationId: input.organizationId,
            subscriptionId: input.subscriptionId,
            orderId: input.orderId,
            paymentId: input.paymentId,
            status: input.status,
            payload: input.payload,
            processedAt: resolvedAt,
            credited: input.credited,
            issue: input.issue,
            eventAt: input.eventAt,
          },
        });

        if (input.status === 'unsubscribed') {
          await resolveUnsubscribe(tx, input.orderId, resolvedAt);
        }

        if (input.checkout) {
          await tx.billingCheckoutOrder.update({
            where: { id: input.checkout.id, status: 'PROPOSED' },
            data: {
              status: input.checkout.outcome === 'paid' ? 'PAID' : 'ABANDONED',
              resolvedAt,
            },
          });

          // A paid checkout retires the ones it was offered alongside. Leaving them open would
          // let a second LiqPay page, opened before this one, still create a parallel charge.
          if (input.checkout.outcome === 'paid') {
            await tx.billingCheckoutOrder.updateMany({
              where: {
                subscriptionId: input.subscriptionId,
                status: 'PROPOSED',
                id: { not: input.checkout.id },
              },
              data: { status: 'ABANDONED', resolvedAt },
            });
          }
        }

        if (input.unsubscribeOrderId) {
          await queueUnsubscribe(tx, {
            organizationId: input.organizationId,
            subscriptionId: input.subscriptionId,
            orderId: input.unsubscribeOrderId,
          });
        }

        if (input.update) {
          // Conditional on purpose. Two callbacks for different orders read the same subscription
          // before either writes, and an unconditional update would let the second one land on
          // state the first had already replaced - leaving the order it displaced charging a card
          // with nothing queued to stop it.
          const { count } = await tx.subscription.updateMany({
            where: {
              id: input.subscriptionId,
              status: input.previousStatus,
              liqpayOrderId: input.expectedLiqpayOrderId,
              cancelRequestedAt: input.expectedCancelRequestedAt,
              updatedAt: input.expectedUpdatedAt,
            },
            data: input.update,
          });

          if (count === 0) {
            throw new StaleSubscriptionStateError(input.subscriptionId);
          }

          // A cancellation closes the pages the organization left open at LiqPay. Only the
          // callback that records it may do so: a paid charge on the old order carries the
          // cancellation forward untouched, and abandoning on that would quietly retire a
          // checkout the organization opened to subscribe again.
          if (input.abandonOpenCheckouts) {
            await tx.billingCheckoutOrder.updateMany({
              where: { subscriptionId: input.subscriptionId, status: 'PROPOSED' },
              data: { status: 'ABANDONED', resolvedAt },
            });
          }

          // No actor: the change came from LiqPay, not a person. The audit row is written in the
          // same transaction as the state change so the log can never disagree with the row.
          await tx.auditLog.create({
            data: {
              organizationId: input.organizationId,
              action: 'UPDATE_SUBSCRIPTION',
              entityType: 'Subscription',
              entityId: input.subscriptionId,
              metadata: {
                from: input.previousStatus,
                to: input.nextStatus,
                callbackStatus: input.status,
              },
            },
          });
        }
      });

      return { duplicate: false };
    } catch (error: unknown) {
      // A unique violation only means "already delivered" when it was the callback row that
      // collided. Any other one raised inside the same transaction - the live order id, say - is
      // a real failure, and reporting it as a duplicate would silently drop a state change.
      if (error instanceof StaleSubscriptionStateError) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new StaleSubscriptionStateError(input.subscriptionId);
      }

      if (isUniqueConstraintError(error) && (await this.hasCallback(input))) {
        return { duplicate: true };
      }

      throw error;
    }
  }

  /**
   * The two things a callback has to be judged against besides the subscription row: how recent
   * the newest event we have already applied is, and whether this very payment is already on
   * record as failed. Both come from the callback log, which until now was written and never read
   * for anything but duplicate detection.
   */
  async findPaymentHistory(input: {
    subscriptionId: string;
    orderId: string;
    paymentId: string;
  }): Promise<{ lastEventAt: Date | null; paymentAlreadyFailed: boolean }> {
    const [latest, failed] = await Promise.all([
      this.prisma.billingCallback.aggregate({
        where: { subscriptionId: input.subscriptionId, eventAt: { not: null } },
        _max: { eventAt: true },
      }),
      this.prisma.billingCallback.findFirst({
        where: {
          orderId: input.orderId,
          paymentId: input.paymentId,
          status: { in: [...FAILED_CALLBACK_STATUSES] },
        },
        select: { id: true },
      }),
    ]);

    return { lastEventAt: latest._max.eventAt, paymentAlreadyFailed: failed !== null };
  }

  private async hasCallback(input: {
    orderId: string;
    paymentId: string;
    status: string;
    credited: boolean;
  }): Promise<boolean> {
    const existing = await this.prisma.billingCallback.findFirst({
      where: {
        orderId: input.orderId,
        paymentId: input.paymentId,
        OR: [{ status: input.status }, ...(input.credited ? [{ credited: true }] : [])],
      },
      select: { id: true },
    });

    return existing !== null;
  }

  /**
   * Persist cancellation intent and its fixed access deadline with the order to stop.
   * The expected version prevents canceling a newer subscription that won a concurrent checkout.
   */
  cancel(input: {
    organizationId: string;
    actorUserId: string;
    /** The state the cancellation was computed from, refusing the write if the row has moved. */
    expectedUpdatedAt: Date;
    data: Prisma.SubscriptionUpdateInput;
    /** The live order to stop, queued rather than called: LiqPay may be down or say no. */
    unsubscribeOrderId: string | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.update({
        where: { organizationId: input.organizationId, updatedAt: input.expectedUpdatedAt },
        data: input.data,
      });

      if (input.unsubscribeOrderId) {
        await queueUnsubscribe(tx, {
          organizationId: input.organizationId,
          subscriptionId: subscription.id,
          orderId: input.unsubscribeOrderId,
        });
      }

      // Checkouts still open at LiqPay are closed here too: an organization that cancelled must
      // not be revived by a page it left behind.
      await tx.billingCheckoutOrder.updateMany({
        where: { subscriptionId: subscription.id, status: 'PROPOSED' },
        data: { status: 'ABANDONED', resolvedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'CANCEL_SUBSCRIPTION',
          entityType: 'Subscription',
          entityId: subscription.id,
        },
      });

      return subscription;
    });
  }

  /**
   * Subscriptions whose deadline has passed. Exempt rows are excluded here rather than at the
   * call site: a complimentary organization must never be walked into RESTRICTED by a job.
   *
   * PENDING rows with no `restrictAfter` are left alone on purpose. They are organizations
   * created after rollout, which entitlement resolution already treats as read-only, so
   * flipping their status would only produce a misleading "you are now read-only" notice.
   */
  listRestrictionDue(now: Date) {
    return this.prisma.subscription.findMany({
      where: {
        isExempt: false,
        organization: { status: 'ACTIVE', deletedAt: null },
        OR: [...restrictionDue(now), cancellationDue(now)],
      },
      select: {
        id: true,
        organizationId: true,
        status: true,
        cancelRequestedAt: true,
        organization: { select: ADMIN_MEMBERS_SELECT },
      },
    });
  }

  /** Organizations still inside their rollout window, so they can be warned before it closes. */
  listTransitionWindowOpen(now: Date) {
    return this.prisma.subscription.findMany({
      where: {
        isExempt: false,
        status: 'PENDING',
        restrictAfter: { gt: now },
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: {
        id: true,
        organizationId: true,
        restrictAfter: true,
        organization: { select: ADMIN_MEMBERS_SELECT },
      },
    });
  }

  /**
   * Active subscriptions whose paid period ended without any callback arriving. Nothing else in
   * the system notices an undelivered callback, so without this a single lost webhook grants an
   * organization free access indefinitely.
   */
  listUnconfirmedRenewals(cutoff: Date) {
    return this.prisma.subscription.findMany({
      where: {
        isExempt: false,
        status: 'ACTIVE',
        cancelRequestedAt: null,
        currentPeriodEndsAt: { lte: cutoff },
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: {
        id: true,
        organizationId: true,
        // The order to ask LiqPay about before concluding the renewal never happened.
        liqpayOrderId: true,
        organization: { select: ADMIN_MEMBERS_SELECT },
      },
    });
  }

  listOpenUnsubscribeRequests() {
    return this.prisma.billingUnsubscribeRequest.findMany({
      where: { resolvedAt: null },
      select: { id: true, organizationId: true, subscriptionId: true, orderId: true },
    });
  }

  resolveUnsubscribeRequest(orderId: string) {
    return resolveUnsubscribe(this.prisma, orderId, new Date());
  }

  /**
   * Rollout windows that ran out while nothing was enforcing them. Their organizations were never
   * warned, so the window is handed back rather than spent: restricting on the first enforcing
   * pass would take away write access from every existing church without notice.
   */
  reopenStaleTransitionWindows(input: { staleBefore: Date; restrictAfter: Date }) {
    return this.prisma.subscription.updateMany({
      where: {
        isExempt: false,
        status: 'PENDING',
        restrictAfter: { lte: input.staleBefore },
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      data: { restrictAfter: input.restrictAfter },
    });
  }

  /**
   * Both of these repeat the predicate their row was selected by, and report how many rows they
   * actually changed. The job reads a batch and then writes to it one row at a time, so a
   * callback arriving in between would otherwise be overwritten by a decision made before it -
   * an organization that has just paid pushed into PAST_DUE or RESTRICTED by the same pass that
   * found it overdue.
   */
  markPastDueIfStillUnconfirmed(input: {
    subscriptionId: string;
    cutoff: Date;
    graceEndsAt: Date;
  }) {
    return this.prisma.subscription.updateMany({
      where: {
        id: input.subscriptionId,
        isExempt: false,
        status: 'ACTIVE',
        cancelRequestedAt: null,
        currentPeriodEndsAt: { lte: input.cutoff },
      },
      data: { status: 'PAST_DUE', graceEndsAt: input.graceEndsAt },
    });
  }

  async restrictIfStillDue(subscriptionId: string, now: Date) {
    const canceled = await this.prisma.subscription.updateMany({
      where: { id: subscriptionId, isExempt: false, ...cancellationDue(now) },
      data: { status: 'CANCELED' },
    });
    if (canceled.count) return canceled;
    return this.prisma.subscription.updateMany({
      where: {
        id: subscriptionId,
        isExempt: false,
        cancelRequestedAt: null,
        OR: restrictionDue(now),
      },
      data: { status: 'RESTRICTED', graceEndsAt: null },
    });
  }

  listAdminMembershipIds(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        role: { in: ['OWNER', 'ADMIN'] },
        status: 'ACTIVE',
        removedAt: null,
        userId: { not: null },
      },
      select: { id: true },
    });
  }
}
