import { Injectable } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import type { UpsertWebsitePageInput, UpsertWebsiteSectionInput } from '@churchflow/shared';
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
          organization: { slug: orgSlug, status: 'ACTIVE', deletedAt: null },
        },
      },
      include: {
        website: { include: { organization: true } },
        sections: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async listDashboardPages(organizationId: string) {
    return this.prisma.websitePage.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listPublicPagesForSitemap() {
    return this.prisma.websitePage.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { not: null },
        deletedAt: null,
        website: {
          publishedAt: { not: null },
          deletedAt: null,
          organization: { status: 'ACTIVE', deletedAt: null },
        },
      },
      select: {
        slug: true,
        updatedAt: true,
        website: {
          select: {
            organization: {
              select: { slug: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findDashboardPage(organizationId: string, pageId: string) {
    return this.prisma.websitePage.findFirst({
      where: { id: pageId, organizationId, deletedAt: null },
      include: {
        website: { include: { organization: true } },
        sections: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async createPage(organizationId: string, input: UpsertWebsitePageInput) {
    const website = await this.prisma.organizationWebsite.findUnique({
      where: { organizationId },
      select: { id: true },
    });
    if (!website) throw new Error('WEBSITE_NOT_FOUND');

    return this.prisma.websitePage.create({
      data: {
        organizationId,
        websiteId: website.id,
        slug: input.slug,
        title: input.title,
        status: input.status,
        seo: input.seo as Prisma.InputJsonObject,
        publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
      },
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async updatePage(organizationId: string, pageId: string, input: UpsertWebsitePageInput) {
    return this.prisma.websitePage.update({
      where: { id: pageId, organizationId, deletedAt: null },
      data: {
        slug: input.slug,
        title: input.title,
        status: input.status,
        seo: input.seo as Prisma.InputJsonObject,
        publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
      },
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async setPagePublished(organizationId: string, pageId: string, published: boolean) {
    return this.prisma.websitePage.update({
      where: { id: pageId, organizationId, deletedAt: null },
      data: {
        status: published ? 'PUBLISHED' : 'DRAFT',
        publishedAt: published ? new Date() : null,
      },
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async createSection(organizationId: string, pageId: string, input: UpsertWebsiteSectionInput) {
    const page = await this.prisma.websitePage.findFirst({
      where: { id: pageId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!page) throw new Error('PAGE_NOT_FOUND');

    return this.prisma.websiteSection.create({
      data: {
        organizationId,
        pageId,
        type: input.type,
        order: input.order,
        content: input.content as Prisma.InputJsonObject,
      },
    });
  }

  async updateSection(organizationId: string, sectionId: string, input: UpsertWebsiteSectionInput) {
    return this.prisma.websiteSection.update({
      where: { id: sectionId, organizationId, deletedAt: null },
      data: {
        type: input.type,
        order: input.order,
        content: input.content as Prisma.InputJsonObject,
      },
    });
  }

  async deleteSection(organizationId: string, sectionId: string) {
    return this.prisma.websiteSection.update({
      where: { id: sectionId, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
      select: { id: true },
    });
  }

  async reorderSections(organizationId: string, pageId: string, sectionIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      const sections = await tx.websiteSection.findMany({
        where: {
          id: { in: sectionIds },
          organizationId,
          pageId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (sections.length !== sectionIds.length) {
        throw new Error('SECTION_NOT_FOUND');
      }

      await Promise.all(
        sectionIds.map((sectionId, order) =>
          tx.websiteSection.update({
            where: { id: sectionId },
            data: { order },
          }),
        ),
      );

      return tx.websiteSection.findMany({
        where: { organizationId, pageId, deletedAt: null },
        orderBy: { order: 'asc' },
      });
    });
  }
}

export function isPrismaKnownRequestError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}
