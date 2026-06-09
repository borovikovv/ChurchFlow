import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { createOrganizationSchema } from '@churchflow/shared';
import type { z } from 'zod';

@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: z.infer<typeof createOrganizationSchema>, ownerUserId: string) {
    return this.prisma.organization.create({
      data: {
        ...input,
        members: {
          create: {
            userId: ownerUserId,
            role: 'OWNER',
            permissions: ['members.manage', 'website.manage', 'media.manage', 'billing.manage']
          }
        },
        website: {
          create: {
            title: input.name,
            description: input.description
          }
        }
      }
    });
  }
}
