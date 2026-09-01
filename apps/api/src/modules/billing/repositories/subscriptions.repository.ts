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

  findByOrderId(orderId: string) {
    return this.prisma.subscription.findUnique({ where: { liqpayOrderId: orderId } });
  }

  /**
   * Pins the price. LiqPay fixes amount and currency when the subscription is created, so the
   * UAH figure is stored once here and never recomputed per charge; changing the price means
   * re-subscribing. `usdReference` records what that amount was an equivalent of.
   */
  startSubscription(input: {
    organizationId: string;
    orderId: string;
    amountMinor: number;
    currency: string;
    usdReference: number;
    fxRateUsedAt: Date;
  }) {
    return this.prisma.subscription.update({
      where: { organizationId: input.organizationId },
      data: {
        liqpayOrderId: input.orderId,
        liqpaySubscribedAt: null,
        amountMinor: input.amountMinor,
        currency: input.currency,
        usdReference: new Prisma.Decimal(input.usdReference),
        fxRateUsedAt: input.fxRateUsedAt,
      },
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
    payload: Prisma.InputJsonObject;
    update: Prisma.SubscriptionUpdateInput | null;
  }): Promise<{ duplicate: boolean }> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.billingCallback.create({
          data: {
            organizationId: input.organizationId,
            subscriptionId: input.subscriptionId,
            orderId: input.orderId,
            paymentId: input.paymentId,
            status: input.status,
            payload: input.payload,
            processedAt: new Date(),
          },
        });

        if (input.update) {
          await tx.subscription.update({
            where: { id: input.subscriptionId },
            data: input.update,
          });
        }
      });

      return { duplicate: false };
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return { duplicate: true };
      }

      throw error;
    }
  }

  cancel(organizationId: string) {
    return this.prisma.subscription.update({
      where: { organizationId },
      data: { status: 'CANCELED', graceEndsAt: null },
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
