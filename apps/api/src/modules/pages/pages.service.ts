import { Injectable, NotFoundException } from '@nestjs/common';
import { PagesRepository } from './repositories/pages.repository';

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
}
