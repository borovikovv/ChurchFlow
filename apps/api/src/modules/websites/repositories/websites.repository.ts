import { Injectable } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import type { UpdateWebsiteSettingsInput } from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class WebsitesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPublicWebsite(orgSlug: string) {
    return this.prisma.organizationWebsite.findFirst({
      where: {
        publishedAt: { not: null },
        deletedAt: null,
        organization: { slug: orgSlug, status: 'ACTIVE', deletedAt: null },
      },
      include: { organization: true },
    });
  }

  async findByOrganizationId(organizationId: string) {
    return this.prisma.organizationWebsite.findUnique({
      where: { organizationId },
      include: { organization: true },
    });
  }

  async updateSettings(organizationId: string, input: UpdateWebsiteSettingsInput) {
    return this.prisma.organizationWebsite.update({
      where: { organizationId },
      data: {
        title: input.title,
        description: input.description ?? null,
        theme: input.theme as Prisma.InputJsonObject,
        settings: input.settings as Prisma.InputJsonObject,
      },
      include: { organization: true },
    });
  }

  async setPublished(organizationId: string, published: boolean) {
    return this.prisma.organizationWebsite.update({
      where: { organizationId },
      data: { publishedAt: published ? new Date() : null },
      include: { organization: true },
    });
  }
}
