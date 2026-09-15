import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApplyWebsiteTemplateInput, UpdateWebsiteSettingsInput } from '@churchflow/shared';
import { MediaService } from '../media/media.service';
import { normalizeWebsiteSettings, normalizeWebsiteTheme, toPublicWebsite } from './public-website';
import { WebsitesRepository } from './repositories/websites.repository';

@Injectable()
export class WebsitesService {
  constructor(
    private readonly websitesRepository: WebsitesRepository,
    private readonly mediaService: MediaService,
  ) {}

  async findPublicWebsite(orgSlug: string) {
    const website = await this.websitesRepository.findPublicWebsite(orgSlug);
    if (!website) return null;

    const publicWebsite = toPublicWebsite(website);
    publicWebsite.settings.seo.ogImageUrl = await this.readUrlOrNull(
      publicWebsite.settings.seo.ogImageAssetId,
      website.organizationId,
    );

    return publicWebsite;
  }

  async findByOrganizationId(organizationId: string) {
    const website = await this.websitesRepository.findByOrganizationId(organizationId);

    if (!website) {
      throw new NotFoundException('Website not found');
    }

    return this.toDashboardWebsite(website);
  }

  async updateSettings(organizationId: string, input: UpdateWebsiteSettingsInput) {
    try {
      return this.toDashboardWebsite(
        await this.websitesRepository.updateSettings(organizationId, input),
      );
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async setPublished(organizationId: string, published: boolean) {
    try {
      return this.toDashboardWebsite(
        await this.websitesRepository.setPublished(organizationId, published),
      );
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async applyTemplate(
    organizationId: string,
    actorUserId: string,
    input: ApplyWebsiteTemplateInput,
  ) {
    try {
      const result = await this.websitesRepository.applyTemplate({
        organizationId,
        actorUserId,
        template: input,
      });

      return {
        website: this.toDashboardWebsite(result.website),
        page: result.page,
        addedSections: result.addedSections,
      };
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private toDashboardWebsite<TWebsite extends { theme: unknown; settings: unknown }>(
    website: TWebsite,
  ) {
    return {
      ...website,
      theme: normalizeWebsiteTheme(website.theme),
      settings: normalizeWebsiteSettings(website.settings),
    };
  }

  private async readUrlOrNull(assetId: string | null, organizationId: string) {
    if (!assetId) return null;
    try {
      return (await this.mediaService.getReadUrl(assetId, organizationId)).url;
    } catch {
      // A missing social image must not take the whole website down with it.
      return null;
    }
  }

  private toHttpError(error: unknown) {
    if (error instanceof Error && error.message === 'WEBSITE_NOT_FOUND') {
      return new NotFoundException('Website not found');
    }
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      return new NotFoundException('Website not found');
    }

    return error;
  }
}
