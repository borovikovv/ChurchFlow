import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ReorderWebsiteSectionsInput,
  UpsertWebsitePageInput,
  UpsertWebsiteSectionInput,
  WebsiteSection,
} from '@churchflow/shared';
import { MediaService } from '../media/media.service';
import {
  enrichSectionBackgrounds,
  normalizeWebsiteSettings,
  readSeo,
  toDashboardPage,
  toPublicSection,
  toPublicWebsite,
  type ReadAssetUrl,
} from '../websites/public-website';
import { resolveSectionsContent } from '../websites/section-data';
import { isPrismaKnownRequestError, PagesRepository } from './repositories/pages.repository';

@Injectable()
export class PagesService {
  constructor(
    private readonly pagesRepository: PagesRepository,
    private readonly mediaService: MediaService,
  ) {}

  async findPublicPage(orgSlug: string, pageSlug: string) {
    const page = await this.pagesRepository.findPublicPage(orgSlug, pageSlug);

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return this.toPublicPage(page);
  }

  async findPreviewPage(organizationId: string, pageId: string) {
    const page = await this.pagesRepository.findDashboardPage(organizationId, pageId);

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return this.toPublicPage({
      ...page,
      sections: page.sections.filter((section) => !section.hidden),
    });
  }

  async listDashboardPages(organizationId: string) {
    const pages = await this.pagesRepository.listDashboardPages(organizationId);

    return Promise.all(pages.map((page) => this.toDashboardPage(page)));
  }

  async listPublicPagesForSitemap() {
    const pages = await this.pagesRepository.listPublicPagesForSitemap();

    return pages
      .filter(
        (page) =>
          !readSeo(page.seo).noindex &&
          !normalizeWebsiteSettings(page.website.settings).seo.noindex,
      )
      .map((page) => ({
        orgSlug: page.website.organization.slug,
        pageSlug: page.slug,
        updatedAt: page.updatedAt,
      }));
  }

  async findDashboardPage(organizationId: string, pageId: string) {
    const page = await this.pagesRepository.findDashboardPage(organizationId, pageId);

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return this.toDashboardPage(page);
  }

  async createPage(organizationId: string, actorUserId: string, input: UpsertWebsitePageInput) {
    try {
      return await this.toDashboardPage(
        await this.pagesRepository.createPage(organizationId, actorUserId, input),
      );
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async updatePage(
    organizationId: string,
    actorUserId: string,
    pageId: string,
    input: UpsertWebsitePageInput,
  ) {
    try {
      return await this.toDashboardPage(
        await this.pagesRepository.updatePage(organizationId, actorUserId, pageId, input),
      );
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async setPagePublished(
    organizationId: string,
    actorUserId: string,
    pageId: string,
    published: boolean,
  ) {
    try {
      return await this.toDashboardPage(
        await this.pagesRepository.setPagePublished(organizationId, actorUserId, pageId, published),
      );
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async createSection(organizationId: string, pageId: string, input: UpsertWebsiteSectionInput) {
    try {
      return await this.pagesRepository.createSection(organizationId, pageId, input);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async updateSection(organizationId: string, sectionId: string, input: UpsertWebsiteSectionInput) {
    try {
      return await this.pagesRepository.updateSection(organizationId, sectionId, input);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async setSectionHidden(organizationId: string, sectionId: string, hidden: boolean) {
    try {
      return await this.pagesRepository.setSectionHidden(organizationId, sectionId, hidden);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async duplicateSection(organizationId: string, sectionId: string) {
    try {
      return await this.pagesRepository.duplicateSection(organizationId, sectionId);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async deleteSection(organizationId: string, actorUserId: string, sectionId: string) {
    try {
      return await this.pagesRepository.deleteSection(organizationId, actorUserId, sectionId);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async reorderSections(
    organizationId: string,
    pageId: string,
    input: ReorderWebsiteSectionsInput,
  ) {
    try {
      return await this.pagesRepository.reorderSections(organizationId, pageId, input.sectionIds);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private async toPublicPage(page: {
    organizationId: string;
    title: string;
    seo: unknown;
    sections: Array<{ id: string; type: WebsiteSection['type']; order: number; content: unknown }>;
    website: Parameters<typeof toPublicWebsite>[0] & { logoAssetId: string | null };
  }) {
    const website = toPublicWebsite(page.website);
    const seo = readSeo(page.seo);
    const [enriched, websiteOgImageUrl, logoUrl, pageOgImageUrl] = await Promise.all([
      enrichSectionBackgrounds(page, this.readUrl),
      this.readUrl(website.settings.seo.ogImageAssetId, page.organizationId),
      this.readUrl(page.website.logoAssetId, page.organizationId),
      this.readUrl(seo.ogImageAssetId, page.organizationId),
    ]);

    website.settings.seo.ogImageUrl = websiteOgImageUrl;
    website.organization.logoUrl = logoUrl;

    const resolved = await resolveSectionsContent(enriched.sections, {
      organizationId: page.organizationId,
    });

    return {
      title: page.title,
      seo: { ...seo, ogImageUrl: pageOgImageUrl },
      sections: resolved.map(toPublicSection),
      website,
    };
  }

  private toDashboardPage<
    TPage extends { organizationId: string; seo: unknown; sections: Array<{ content: unknown }> },
  >(page: TPage) {
    return toDashboardPage(page, this.readUrl);
  }

  private readonly readUrl: ReadAssetUrl = async (assetId, organizationId) => {
    if (!assetId) return null;
    try {
      return (await this.mediaService.getReadUrl(assetId, organizationId)).url;
    } catch {
      return null;
    }
  };

  private toHttpError(error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'WEBSITE_NOT_FOUND') return new NotFoundException('Website not found');
      if (error.message === 'PAGE_NOT_FOUND') return new NotFoundException('Page not found');
      if (error.message === 'SECTION_NOT_FOUND') return new NotFoundException('Section not found');
    }

    if (isPrismaKnownRequestError(error)) {
      if (error.code === 'P2002') return new ConflictException('Page slug already exists');
      if (error.code === 'P2025') return new NotFoundException('Record not found');
    }

    return error;
  }
}
