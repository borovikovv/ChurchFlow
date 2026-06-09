import { Injectable } from '@nestjs/common';
import { PagesRepository } from './repositories/pages.repository';

@Injectable()
export class PagesService {
  constructor(private readonly pagesRepository: PagesRepository) {}

  async findPublicPage(orgSlug: string, pageSlug: string) {
    return this.pagesRepository.findPublicPage(orgSlug, pageSlug);
  }

  async listDashboardPages(organizationId: string) {
    return this.pagesRepository.listDashboardPages(organizationId);
  }
}
