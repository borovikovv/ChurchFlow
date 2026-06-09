import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listForOrganization(organizationId: string) {
    return this.prisma.mediaAsset.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }
}
