import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class WebsitesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPublicWebsite(orgSlug: string) {
    return this.prisma.organizationWebsite.findFirst({
      where: {
        publishedAt: { not: null },
        deletedAt: null,
        organization: { slug: orgSlug, deletedAt: null }
      },
      include: { organization: true }
    });
  }

  async findByOrganizationId(organizationId: string) {
    return this.prisma.organizationWebsite.findUnique({ where: { organizationId } });
  }
}
