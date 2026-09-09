import { Injectable } from '@nestjs/common';
import type { OrganizationRole, OrganizationStatus, PlatformRole, Prisma } from '@churchflow/db';
import { PrismaService } from '../../../prisma/prisma.service';
import { queueUnsubscribe } from '../../billing/billing-unsubscribe-queue';
import { canRequestCancellation } from '../../billing/subscription-transitions';
import type { createOrganizationSchema, UpdateOrganizationInput } from '@churchflow/shared';
import type { z } from 'zod';

const BILLING_EXEMPTION_HISTORY_LIMIT = 20;

@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        removedAt: null,
      },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            description: true,
            createdAt: true,
            website: {
              select: {
                logoAssetId: true,
              },
            },
            subscription: {
              select: {
                status: true,
                isExempt: true,
                restrictAfter: true,
                graceEndsAt: true,
                cancelRequestedAt: true,
              },
            },
            _count: {
              select: {
                members: {
                  where: {
                    status: { in: ['ACTIVE', 'SUSPENDED'] },
                    removedAt: null,
                  },
                },
                invitations: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map(({ organization, role }) => ({ ...organization, role }));
  }

  async listMineAdmin(userId: string, status?: OrganizationStatus) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
        status: 'ACTIVE',
        removedAt: null,
        ...(status ? { organization: { status } } : {}),
      },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            description: true,
            createdAt: true,
            website: {
              select: {
                logoAssetId: true,
              },
            },
            subscription: { select: { isExempt: true } },
            _count: {
              select: {
                members: {
                  where: {
                    status: { in: ['ACTIVE', 'SUSPENDED'] },
                    removedAt: null,
                  },
                },
                invitations: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map(({ organization, role }) => ({ ...organization, role }));
  }

  async create(input: z.infer<typeof createOrganizationSchema>, ownerUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.findFirst({
        where: {
          id: ownerUserId,
          deletedAt: null,
          accounts: { some: { provider: 'telegram', deletedAt: null } },
        },
        select: { id: true, displayName: true, email: true },
      });
      if (!owner) {
        throw new Error('ORGANIZATION_OWNER_INACTIVE');
      }

      const organization = await tx.organization.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          status: 'ACTIVE',
          members: {
            create: {
              userId: ownerUserId,
              role: 'OWNER',
              status: 'ACTIVE',
              source: 'EXISTING',
              createdByUserId: ownerUserId,
              claimedAt: new Date(),
              profile: {
                create: {
                  displayName: owner.displayName ?? owner.email ?? 'Owner',
                  email: owner.email,
                },
              },
            },
          },
          website: {
            create: {
              title: input.name,
              description: input.description ?? null,
            },
          },
          // Entitlement resolution reads a missing subscription as "no entitlements", so the
          // row is created with the organization rather than left to a later job. No
          // restrictAfter: only organizations that predate billing get a transition window.
          subscription: {
            create: {
              status: 'PENDING',
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          actorUserId: ownerUserId,
          action: 'CREATE',
          entityType: 'Organization',
          entityId: organization.id,
          metadata: {
            source: 'platform_admin_direct_creation',
            ownerUserId,
          },
        },
      });

      return organization;
    });
  }

  async listAdmin(status?: string) {
    return this.prisma.organization.findMany({
      ...(status ? { where: { status: status as OrganizationStatus } } : {}),
      include: {
        website: true,
        subscription: { select: { isExempt: true } },
        _count: {
          select: {
            members: {
              where: {
                status: { in: ['ACTIVE', 'SUSPENDED'] },
                removedAt: null,
              },
            },
            invitations: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAdminById(id: string) {
    return this.prisma.organization.findUnique({
      where: { id },
      include: {
        website: true,
        members: { include: { user: true }, orderBy: { createdAt: 'desc' } },
        invitations: { orderBy: { createdAt: 'desc' } },
        subscription: {
          include: {
            exemptGrantedBy: { select: { id: true, displayName: true, email: true } },
          },
        },
      },
    });
  }

  /**
   * The history of complimentary access. Revoking clears the grant off the subscription row, so
   * who granted it, when and why survives only here - and the audit log is not readable from the
   * admin interface at all.
   */
  findBillingExemptionHistory(organizationId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        organizationId,
        action: { in: ['GRANT_BILLING_EXEMPTION', 'REVOKE_BILLING_EXEMPTION'] },
      },
      orderBy: { createdAt: 'desc' },
      take: BILLING_EXEMPTION_HISTORY_LIMIT,
      select: {
        id: true,
        action: true,
        createdAt: true,
        metadata: true,
        actor: { select: { displayName: true, email: true } },
      },
    });
  }

  /**
   * Complimentary access is an override applied when entitlements are resolved; it deliberately
   * does not touch `status`. Revoking therefore drops the organization straight back to whatever
   * its subscription actually was - PENDING, PAST_DUE or RESTRICTED - with no way to leave it
   * looking ACTIVE by accident.
   *
   * What it does replace is the payment. An organization told it pays nothing must not keep
   * being charged, so a live LiqPay order is queued to be stopped and any checkout still open is
   * closed - both inside the transaction that records the grant, so neither can happen without
   * the other. The order that was stopped is reported back for the caller to act on.
   */
  async setBillingExemption(input: {
    organizationId: string;
    actorUserId: string;
    reason: string | null;
  }): Promise<{
    subscription: Prisma.SubscriptionGetPayload<Record<string, never>>;
    stoppedOrderId: string | null;
  }> {
    const granting = input.reason !== null;

    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.update({
        where: { organizationId: input.organizationId },
        data: granting
          ? {
              isExempt: true,
              exemptReason: input.reason,
              exemptGrantedByUserId: input.actorUserId,
              exemptGrantedAt: new Date(),
            }
          : {
              isExempt: false,
              exemptReason: null,
              exemptGrantedByUserId: null,
              exemptGrantedAt: null,
            },
      });

      // A cancelled subscription has already been through this: its order is either stopped or
      // queued, and claiming to have stopped it a second time would only mislead.
      const stoppedOrderId =
        granting && canRequestCancellation(subscription) ? subscription.liqpayOrderId : null;

      if (granting) {
        if (stoppedOrderId) {
          await queueUnsubscribe(tx, {
            organizationId: input.organizationId,
            subscriptionId: subscription.id,
            orderId: stoppedOrderId,
          });
        }

        // A checkout left open is a page that can still be paid for. The organization pays
        // nothing from now on, so nothing payable may be left standing behind it.
        await tx.billingCheckoutOrder.updateMany({
          where: { subscriptionId: subscription.id, status: 'PROPOSED' },
          data: { status: 'ABANDONED', resolvedAt: new Date() },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: granting ? 'GRANT_BILLING_EXEMPTION' : 'REVOKE_BILLING_EXEMPTION',
          entityType: 'Subscription',
          entityId: subscription.id,
          metadata: granting
            ? {
                reason: input.reason,
                subscriptionStatus: subscription.status,
                ...(stoppedOrderId ? { stoppedOrderId } : {}),
              }
            : { subscriptionStatus: subscription.status },
        },
      });

      return { subscription, stoppedOrderId };
    });
  }

  async changeStatus(id: string, action: 'ARCHIVE' | 'SUSPEND' | 'RESTORE' | 'DELETE') {
    const now = new Date();
    const dataByAction: Record<typeof action, Prisma.OrganizationUpdateInput> = {
      ARCHIVE: { status: 'ARCHIVED', archivedAt: now },
      SUSPEND: { status: 'SUSPENDED', suspendedAt: now },
      RESTORE: { status: 'ACTIVE', archivedAt: null, suspendedAt: null, deletedAt: null },
      DELETE: { status: 'DELETED', deletedAt: now },
    };

    return this.prisma.organization.update({
      where: { id },
      data: dataByAction[action],
    });
  }

  findActiveById(id: string) {
    return this.prisma.organization.findFirst({
      where: { id, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
  }

  findOrganizationManager(organizationId: string, actorUserId: string) {
    return this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: actorUserId,
        role: { in: ['OWNER', 'ADMIN'] },
        status: 'ACTIVE',
        removedAt: null,
        organization: {
          status: 'ACTIVE',
          deletedAt: null,
        },
      },
      select: { id: true, role: true },
    });
  }

  async update(
    id: string,
    input: UpdateOrganizationInput,
    actorUserId: string,
    actorRole: OrganizationRole,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.organization.findFirst({
        where: { id, status: 'ACTIVE', deletedAt: null },
        select: { name: true, slug: true, description: true },
      });
      if (!current) throw new Error('ORGANIZATION_NOT_FOUND');

      const data: Prisma.OrganizationUpdateInput = {};
      const changedFields: string[] = [];
      const previous: Record<string, string | null> = {};
      const next: Record<string, string | null> = {};

      if (input.name !== undefined && input.name !== current.name) {
        data.name = input.name;
        changedFields.push('name');
        previous['name'] = current.name;
        next['name'] = input.name;
      }
      if (input.slug !== undefined && input.slug !== current.slug) {
        // The slug is the public site address: changing it moves the church's website to a new
        // URL and 404s every link already handed out. Comparing against the current value first
        // matters because the edit form always submits the slug, changed or not.
        if (actorRole !== 'OWNER') {
          throw new Error('SLUG_OWNER_ONLY');
        }

        data.slug = input.slug;
        changedFields.push('slug');
        previous['slug'] = current.slug;
        next['slug'] = input.slug;
      }
      if (input.description !== undefined && input.description !== current.description) {
        data.description = input.description;
        changedFields.push('description');
        previous['description'] = current.description;
        next['description'] = input.description;
      }

      if (changedFields.length === 0) {
        return tx.organization.findUniqueOrThrow({
          where: { id },
          include: { website: true },
        });
      }

      const organization = await tx.organization.update({
        where: { id },
        data,
        include: { website: true },
      });

      // Nothing about the website is written here. The site title, its description and the home
      // page title belong to the website settings screen; rewriting them from a profile rename
      // let an editor change published content they were never editing.

      await tx.auditLog.create({
        data: {
          organizationId: id,
          actorUserId,
          action: 'UPDATE_ORGANIZATION_PROFILE',
          entityType: 'Organization',
          entityId: id,
          metadata: {
            changedFields,
            previous,
            next,
          },
        },
      });

      return organization;
    });
  }

  async findPlatformRole(userId: string): Promise<PlatformRole | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { platformRole: true },
    });

    return user?.platformRole ?? null;
  }
}
