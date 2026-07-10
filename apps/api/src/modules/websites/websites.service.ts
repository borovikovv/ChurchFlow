import { Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateWebsiteSettingsInput } from '@churchflow/shared';
import { WebsitesRepository } from './repositories/websites.repository';

@Injectable()
export class WebsitesService {
  constructor(private readonly websitesRepository: WebsitesRepository) {}

  async findPublicWebsite(orgSlug: string) {
    return this.websitesRepository.findPublicWebsite(orgSlug);
  }

  async findByOrganizationId(organizationId: string) {
    const website = await this.websitesRepository.findByOrganizationId(organizationId);

    if (!website) {
      throw new NotFoundException('Website not found');
    }

    return website;
  }

  async updateSettings(organizationId: string, input: UpdateWebsiteSettingsInput) {
    try {
      return await this.websitesRepository.updateSettings(organizationId, input);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async setPublished(organizationId: string, published: boolean) {
    try {
      return await this.websitesRepository.setPublished(organizationId, published);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private toHttpError(error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      return new NotFoundException('Website not found');
    }

    return error;
  }
}
