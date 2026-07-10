import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ReorderWebsiteSectionsInput,
  UpsertWebsitePageInput,
  UpsertWebsiteSectionInput,
} from '@churchflow/shared';
import { MediaService } from '../media/media.service';
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

    return this.enrichSectionBackgrounds(page);
  }

  async listDashboardPages(organizationId: string) {
    const pages = await this.pagesRepository.listDashboardPages(organizationId);

    return Promise.all(pages.map((page) => this.enrichSectionBackgrounds(page)));
  }

  async listPublicPagesForSitemap() {
    const pages = await this.pagesRepository.listPublicPagesForSitemap();

    return pages.map((page) => ({
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

    return this.enrichSectionBackgrounds(page);
  }

  async createPage(organizationId: string, input: UpsertWebsitePageInput) {
    try {
      return await this.pagesRepository.createPage(organizationId, input);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async updatePage(organizationId: string, pageId: string, input: UpsertWebsitePageInput) {
    try {
      return await this.pagesRepository.updatePage(organizationId, pageId, input);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async setPagePublished(organizationId: string, pageId: string, published: boolean) {
    try {
      return await this.pagesRepository.setPagePublished(organizationId, pageId, published);
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

  async deleteSection(organizationId: string, sectionId: string) {
    try {
      return await this.pagesRepository.deleteSection(organizationId, sectionId);
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

  private async enrichSectionBackgrounds<
    TPage extends {
      organizationId: string;
      sections: Array<{ content: unknown }>;
    },
  >(page: TPage): Promise<TPage> {
    const assetIds = new Set<string>();
    page.sections.forEach((section) => {
      const assetId = readContentText(section.content, 'backgroundImageAssetId');
      if (assetId) assetIds.add(assetId);
    });

    if (assetIds.size === 0) {
      return page;
    }

    const urls = new Map<string, string>();
    await Promise.all(
      [...assetIds].map(async (assetId) => {
        try {
          const result = await this.mediaService.getReadUrl(assetId, page.organizationId);
          urls.set(assetId, result.url);
        } catch {
          // Missing background assets should not hide otherwise published page content.
        }
      }),
    );

    return {
      ...page,
      sections: page.sections.map((section) => {
        const assetId = readContentText(section.content, 'backgroundImageAssetId');
        if (!assetId || !urls.has(assetId)) return section;

        return {
          ...section,
          content:
            typeof section.content === 'object' && section.content !== null
              ? { ...section.content, backgroundImageUrl: urls.get(assetId) }
              : section.content,
        };
      }),
    };
  }
}

function readContentText(content: unknown, key: string): string | undefined {
  if (typeof content !== 'object' || content === null) return undefined;
  const value = (content as Record<string, unknown>)[key];

  return typeof value === 'string' && value.trim() ? value : undefined;
}
