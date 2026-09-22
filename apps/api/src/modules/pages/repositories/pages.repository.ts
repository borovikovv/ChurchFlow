import { Injectable } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import type { UpsertWebsitePageInput, UpsertWebsiteSectionInput } from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';

const pageSectionsInclude = {
  sections: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
} satisfies Prisma.WebsitePageInclude;

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
          where: { deletedAt: null, hidden: false },
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
        seo: true,
        updatedAt: true,
        website: {
          select: {
            settings: true,
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

  async createPage(organizationId: string, actorUserId: string, input: UpsertWebsitePageInput) {
    return this.prisma.$transaction(async (tx) => {
      const website = await tx.organizationWebsite.findUnique({
        where: { organizationId },
        select: { id: true },
      });
      if (!website) throw new Error('WEBSITE_NOT_FOUND');

      const page = await tx.websitePage.create({
        data: {
          organizationId,
          websiteId: website.id,
          slug: input.slug,
          title: input.title,
          status: input.status,
          seo: input.seo,
          publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
        },
        include: pageSectionsInclude,
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'CREATE',
          entityType: 'WebsitePage',
          entityId: page.id,
          metadata: { slug: input.slug, title: input.title },
        },
      });

      return page;
    });
  }

  async updatePage(
    organizationId: string,
    actorUserId: string,
    pageId: string,
    input: UpsertWebsitePageInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const page = await tx.websitePage.update({
        where: { id: pageId, organizationId, deletedAt: null },
        data: {
          slug: input.slug,
          title: input.title,
          status: input.status,
          seo: input.seo,
          publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
        },
        include: pageSectionsInclude,
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'UPDATE',
          entityType: 'WebsitePage',
          entityId: pageId,
          metadata: { slug: input.slug, title: input.title, status: input.status },
        },
      });

      return page;
    });
  }

  async setPagePublished(
    organizationId: string,
    actorUserId: string,
    pageId: string,
    published: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const page = await tx.websitePage.update({
        where: { id: pageId, organizationId, deletedAt: null },
        data: {
          status: published ? 'PUBLISHED' : 'DRAFT',
          publishedAt: published ? new Date() : null,
        },
        include: pageSectionsInclude,
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: published ? 'PUBLISH' : 'UNPUBLISH',
          entityType: 'WebsitePage',
          entityId: pageId,
          metadata: { slug: page.slug, title: page.title },
        },
      });

      return page;
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
        hidden: input.hidden,
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
        hidden: input.hidden,
        content: input.content as Prisma.InputJsonObject,
      },
    });
  }

  async setSectionHidden(organizationId: string, sectionId: string, hidden: boolean) {
    return this.prisma.websiteSection.update({
      where: { id: sectionId, organizationId, deletedAt: null },
      data: { hidden },
    });
  }

  async duplicateSection(organizationId: string, sectionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.websiteSection.findFirst({
        where: { id: sectionId, organizationId, deletedAt: null },
      });
      if (!source) throw new Error('SECTION_NOT_FOUND');

      await tx.websiteSection.updateMany({
        where: {
          pageId: source.pageId,
          organizationId,
          deletedAt: null,
          order: { gt: source.order },
        },
        data: { order: { increment: 1 } },
      });

      return tx.websiteSection.create({
        data: {
          organizationId,
          pageId: source.pageId,
          type: source.type,
          order: source.order + 1,
          hidden: source.hidden,
          content: source.content as Prisma.InputJsonObject,
        },
      });
    });
  }

  async deleteSection(organizationId: string, actorUserId: string, sectionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const section = await tx.websiteSection.update({
        where: { id: sectionId, organizationId, deletedAt: null },
        data: { deletedAt: new Date() },
        select: { id: true, type: true, pageId: true },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'DELETE',
          entityType: 'WebsiteSection',
          entityId: sectionId,
          metadata: { type: section.type, pageId: section.pageId },
        },
      });

      return { id: section.id };
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
