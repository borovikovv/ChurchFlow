import { Injectable } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import type { SubscriptionEntitlementState } from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';

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
      },
    });
  }

  findByOrganizationId(organizationId: string) {
    return this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { organization: { select: { id: true, name: true } } },
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
   * Records the callback and applies its state change in one transaction. Idempotency is the
   * unique (order_id, payment_id) index rather than a read-then-write check, so two callbacks
   * racing each other cannot both apply.
   */
  async applyCallback(input: {
    subscriptionId: string;
    organizationId: string;
    orderId: string;
    paymentId: string;
    status: string;
    previousStatus: string;
    nextStatus: string | null;
    payload: Prisma.InputJsonObject;
    update: Prisma.SubscriptionUpdateInput | null;
    checkout: CheckoutResolution | null;
    /** An order this callback supersedes, queued for LiqPay to stop charging. */
    unsubscribeOrderId: string | null;
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
          },
        });

        if (input.checkout) {
          await tx.billingCheckoutOrder.update({
            where: { id: input.checkout.id },
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
          await this.queueUnsubscribe(tx, {
            organizationId: input.organizationId,
            subscriptionId: input.subscriptionId,
            orderId: input.unsubscribeOrderId,
          });
        }

        if (input.update) {
          await tx.subscription.update({
            where: { id: input.subscriptionId },
            data: input.update,
          });

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
      if (isUniqueConstraintError(error) && (await this.hasCallback(input))) {
        return { duplicate: true };
      }

      throw error;
    }
  }

  private async hasCallback(input: {
    orderId: string;
    paymentId: string;
    status: string;
  }): Promise<boolean> {
    const existing = await this.prisma.billingCallback.findFirst({
      where: { orderId: input.orderId, paymentId: input.paymentId, status: input.status },
      select: { id: true },
    });

    return existing !== null;
  }

  /**
   * Queued rather than written to a slot on the subscription: LiqPay may owe us more than one
   * cancellation at a time, and an order dropped here is an order that keeps charging a card.
   * Requeueing an order already listed reopens its row instead of adding a second one.
   */
  private queueUnsubscribe(
    tx: Prisma.TransactionClient,
    input: { organizationId: string; subscriptionId: string; orderId: string },
  ) {
    return tx.billingUnsubscribeRequest.upsert({
      where: { orderId: input.orderId },
      create: {
        organizationId: input.organizationId,
        subscriptionId: input.subscriptionId,
        orderId: input.orderId,
      },
      update: { resolvedAt: null },
    });
  }

  /**
   * An unsubscribe LiqPay refused is queued, because the alternative is showing CANCELED while
   * the card keeps being charged every month. Only the order this cancellation actually stopped
   * is resolved: an order queued by an earlier failure is still charging and stays queued.
   */
  cancel(
    organizationId: string,
    actorUserId: string,
    unsubscribe: { orderId: string; stopped: boolean } | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.update({
        where: { organizationId },
        data: {
          status: 'CANCELED',
          graceEndsAt: null,
        },
      });

      if (unsubscribe && !unsubscribe.stopped) {
        await this.queueUnsubscribe(tx, {
          organizationId,
          subscriptionId: subscription.id,
          orderId: unsubscribe.orderId,
        });
      }

      if (unsubscribe?.stopped) {
        await tx.billingUnsubscribeRequest.updateMany({
          where: { orderId: unsubscribe.orderId, resolvedAt: null },
          data: { resolvedAt: new Date() },
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
          organizationId,
          actorUserId,
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
        OR: [
          { status: 'PENDING', restrictAfter: { lte: now } },
          { status: 'PAST_DUE', graceEndsAt: { lte: now } },
        ],
      },
      select: {
        id: true,
        organizationId: true,
        status: true,
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
        currentPeriodEndsAt: { lte: cutoff },
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: {
        id: true,
        organizationId: true,
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
    return this.prisma.billingUnsubscribeRequest.updateMany({
      where: { orderId, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
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

  markPastDue(subscriptionId: string, graceEndsAt: Date) {
    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'PAST_DUE', graceEndsAt },
    });
  }

  restrict(subscriptionId: string) {
    return this.prisma.subscription.update({
      where: { id: subscriptionId },
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
