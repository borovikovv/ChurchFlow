import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ReorderWebsiteSectionsInput,
  UpsertWebsitePageInput,
  UpsertWebsiteSectionInput,
} from '@churchflow/shared';
import { isPrismaKnownRequestError, PagesRepository } from './repositories/pages.repository';

@Injectable()
export class PagesService {
  constructor(private readonly pagesRepository: PagesRepository) {}

  async findPublicPage(orgSlug: string, pageSlug: string) {
    const page = await this.pagesRepository.findPublicPage(orgSlug, pageSlug);

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }

  async listDashboardPages(organizationId: string) {
    return this.pagesRepository.listDashboardPages(organizationId);
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

    return page;
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
}
