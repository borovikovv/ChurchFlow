import { Injectable } from '@nestjs/common';
import type { OrganizationStatus, Prisma } from '@churchflow/db';
import { PrismaService } from '../../../prisma/prisma.service';
import type { createOrganizationSchema } from '@churchflow/shared';
import type { z } from 'zod';

@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

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
      },
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
}
