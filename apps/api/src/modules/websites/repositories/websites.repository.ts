import { Injectable } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import {
  websiteTemplate,
  type ApplyWebsiteTemplateInput,
  type UpdateWebsiteSettingsInput,
  type WebsiteTemplateSectionDefinition,
} from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';

const websiteInclude = { organization: true } satisfies Prisma.OrganizationWebsiteInclude;
const homeSectionsInclude = {
  sections: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
} satisfies Prisma.WebsitePageInclude;

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
      include: websiteInclude,
    });
  }

  async findByOrganizationId(organizationId: string) {
    return this.prisma.organizationWebsite.findUnique({
      where: { organizationId },
      include: websiteInclude,
    });
  }

  async updateSettings(organizationId: string, input: UpdateWebsiteSettingsInput) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.organizationWebsite.findUnique({
        where: { organizationId },
        select: { theme: true, settings: true },
      });
      if (!existing) throw new Error('WEBSITE_NOT_FOUND');

      return tx.organizationWebsite.update({
        where: { organizationId },
        data: {
          title: input.title,
          description: input.description ?? null,
          theme: mergeJson(existing.theme, input.theme),
          settings: mergeJson(existing.settings, input.settings),
        },
        include: websiteInclude,
      });
    });
  }

  async setPublished(organizationId: string, published: boolean) {
    return this.prisma.organizationWebsite.update({
      where: { organizationId },
      data: { publishedAt: published ? new Date() : null },
      include: websiteInclude,
    });
  }

  async applyTemplate(input: {
    organizationId: string;
    actorUserId: string;
    template: ApplyWebsiteTemplateInput;
  }) {
    const template = websiteTemplate(input.template.templateId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.organizationWebsite.findUnique({
        where: { organizationId: input.organizationId },
        select: { id: true, theme: true, settings: true },
      });
      if (!existing) throw new Error('WEBSITE_NOT_FOUND');

      const website = await tx.organizationWebsite.update({
        where: { organizationId: input.organizationId },
        data: {
          settings: mergeJson(existing.settings, { template: template.id }),
          ...(input.template.resetTheme
            ? { theme: mergeJson(existing.theme, template.theme) }
            : {}),
        },
        include: websiteInclude,
      });

      const homePage = await tx.websitePage.findFirst({
        where: {
          websiteId: existing.id,
          organizationId: input.organizationId,
          slug: 'home',
          deletedAt: null,
        },
        include: homeSectionsInclude,
      });

      let addedSections = 0;
      let page = homePage;

      if (!homePage) {
        page = await tx.websitePage.create({
          data: {
            organizationId: input.organizationId,
            websiteId: existing.id,
            slug: 'home',
            title: 'Home',
            status: 'DRAFT',
            seo: {},
            sections: {
              create: template.home.map((section, order) => ({
                organizationId: input.organizationId,
                type: section.type,
                order,
                hidden: false,
                content: templateSectionContent(section),
              })),
            },
          },
          include: homeSectionsInclude,
        });
        addedSections = template.home.length;
      } else if (input.template.addMissingSections) {
        const present = new Set(
          homePage.sections.map((section) => sectionKey(section.type, section.content)),
        );
        const missing = template.home.filter(
          (section) => !present.has(`${section.type}:${section.variant}`),
        );
        const nextOrder = homePage.sections.reduce(
          (max, section) => Math.max(max, section.order + 1),
          0,
        );

        for (const [index, section] of missing.entries()) {
          await tx.websiteSection.create({
            data: {
              organizationId: input.organizationId,
              pageId: homePage.id,
              type: section.type,
              order: nextOrder + index,
              hidden: true,
              content: templateSectionContent(section),
            },
          });
        }
        addedSections = missing.length;

        if (missing.length > 0) {
          page = await tx.websitePage.findFirst({
            where: { id: homePage.id, organizationId: input.organizationId },
            include: homeSectionsInclude,
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'UPDATE',
          entityType: 'OrganizationWebsite',
          entityId: existing.id,
          metadata: {
            templateId: template.id,
            addedSections,
            resetTheme: input.template.resetTheme,
          },
        },
      });

      return { website, page, addedSections };
    });
  }
}

function templateSectionContent(section: WebsiteTemplateSectionDefinition): Prisma.InputJsonObject {
  return { variant: section.variant, ...section.content };
}

function sectionKey(type: string, content: unknown): string {
  const variant =
    typeof content === 'object' && content !== null && 'variant' in content
      ? (content as { variant?: unknown }).variant
      : undefined;

  return `${type}:${typeof variant === 'string' && variant.trim() ? variant : type}`;
}

function mergeJson(
  stored: Prisma.JsonValue,
  patch: Record<string, unknown>,
): Prisma.InputJsonObject {
  const base =
    typeof stored === 'object' && stored !== null && !Array.isArray(stored) ? stored : {};
  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) merged[key] = value;
  }

  return merged as Prisma.InputJsonObject;
}
