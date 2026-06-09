import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPublicPage(orgSlug: string, pageSlug: string) {
    return this.prisma.websitePage.findFirst({
      where: {
        slug: pageSlug,
        status: 'PUBLISHED',
        publishedAt: { not: null },
        deletedAt: null,
        website: {
          publishedAt: { not: null },
          deletedAt: null,
          organization: { slug: orgSlug, deletedAt: null }
        }
      },
      include: {
        website: { include: { organization: true } },
        sections: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' }
        }
      }
    });
  }

  async listDashboardPages(organizationId: string) {
    return this.prisma.websitePage.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { updatedAt: 'desc' }
    });
  }
}
