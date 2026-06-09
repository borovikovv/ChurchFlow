import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MembershipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listForOrganization(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId, deletedAt: null },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
  }
}
