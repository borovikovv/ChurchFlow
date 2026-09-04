import { Injectable } from '@nestjs/common';
import type { OrganizationStatus, PlatformRole, Prisma } from '@churchflow/db';
import { PrismaService } from '../../../prisma/prisma.service';
import type { createOrganizationSchema, UpdateOrganizationInput } from '@churchflow/shared';
import type { z } from 'zod';

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
   * Complimentary access is an override applied when entitlements are resolved; it deliberately
   * does not touch `status`. Revoking therefore drops the organization straight back to whatever
   * its subscription actually was - PENDING, PAST_DUE or RESTRICTED - with no way to leave it
   * looking ACTIVE by accident.
   */
  async setBillingExemption(input: {
    organizationId: string;
    actorUserId: string;
    reason: string | null;
  }) {
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

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: granting ? 'GRANT_BILLING_EXEMPTION' : 'REVOKE_BILLING_EXEMPTION',
          entityType: 'Subscription',
          entityId: subscription.id,
          metadata: granting
            ? { reason: input.reason, subscriptionStatus: subscription.status }
            : { subscriptionStatus: subscription.status },
        },
      });

      return subscription;
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
      select: { id: true },
    });
  }

  async update(id: string, input: UpdateOrganizationInput, actorUserId: string) {
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

      await tx.websitePage.updateMany({
        where: {
          organizationId: id,
          slug: 'home',
          title: current.name,
        },
        data: { title: organization.name },
      });

      await tx.organizationWebsite.upsert({
        where: { organizationId: id },
        create: {
          organizationId: id,
          title: organization.name,
          description: organization.description,
        },
        update: {
          title: organization.name,
          description: organization.description,
        },
      });

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
