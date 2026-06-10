import { Injectable } from '@nestjs/common';
import type { OrganizationStatus, Prisma } from '@churchflow/db';
import { PrismaService } from '../../../prisma/prisma.service';
import type { createOrganizationSchema } from '@churchflow/shared';
import type { z } from 'zod';

@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: z.infer<typeof createOrganizationSchema>, ownerUserId: string) {
    return this.prisma.organization.create({
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
            permissions: ['members.manage', 'website.manage', 'media.manage', 'billing.manage']
          }
        },
        website: {
          create: {
            title: input.name,
            description: input.description ?? null
          }
        }
      }
    });
  }

  async listAdmin(status?: string) {
    return this.prisma.organization.findMany({
      ...(status ? { where: { status: status as OrganizationStatus } } : {}),
      include: {
        website: true,
        _count: { select: { members: true, invitations: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findAdminById(id: string) {
    return this.prisma.organization.findUnique({
      where: { id },
      include: {
        website: true,
        members: { include: { user: true }, orderBy: { createdAt: 'desc' } },
        invitations: { orderBy: { createdAt: 'desc' } }
      }
    });
  }

  async changeStatus(id: string, action: 'ARCHIVE' | 'SUSPEND' | 'RESTORE' | 'DELETE') {
    const now = new Date();
    const dataByAction: Record<typeof action, Prisma.OrganizationUpdateInput> = {
      ARCHIVE: { status: 'ARCHIVED', archivedAt: now },
      SUSPEND: { status: 'SUSPENDED', suspendedAt: now },
      RESTORE: { status: 'ACTIVE', archivedAt: null, suspendedAt: null, deletedAt: null },
      DELETE: { status: 'DELETED', deletedAt: now }
    };

    return this.prisma.organization.update({
      where: { id },
      data: dataByAction[action]
    });
  }
}
