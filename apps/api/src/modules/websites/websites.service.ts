import { Injectable } from '@nestjs/common';
import { WebsitesRepository } from './repositories/websites.repository';

@Injectable()
export class WebsitesService {
  constructor(private readonly websitesRepository: WebsitesRepository) {}

  async findPublicWebsite(orgSlug: string) {
    return this.websitesRepository.findPublicWebsite(orgSlug);
  }

  async findByOrganizationId(organizationId: string) {
    return this.websitesRepository.findByOrganizationId(organizationId);
  }
}
