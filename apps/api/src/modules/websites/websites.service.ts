import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApplyWebsiteTemplateInput, UpdateWebsiteSettingsInput } from '@churchflow/shared';
import { MediaService } from '../media/media.service';
import {
  normalizeWebsiteSettings,
  normalizeWebsiteTheme,
  toDashboardPage,
  toPublicWebsite,
  type ReadAssetUrl,
} from './public-website';
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
    publicWebsite.settings.seo.ogImageUrl = await this.readUrl(
      publicWebsite.settings.seo.ogImageAssetId,
      website.organizationId,
    );
    publicWebsite.organization.logoUrl = await this.readUrl(
      website.logoAssetId,
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

  async updateSettings(
    organizationId: string,
    actorUserId: string,
    input: UpdateWebsiteSettingsInput,
  ) {
    try {
      return await this.toDashboardWebsite(
        await this.websitesRepository.updateSettings({
          organizationId,
          actorUserId,
          settings: input,
        }),
      );
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async setPublished(organizationId: string, actorUserId: string, published: boolean) {
    try {
      return await this.toDashboardWebsite(
        await this.websitesRepository.setPublished({ organizationId, actorUserId, published }),
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
        website: await this.toDashboardWebsite(result.website),
        page: result.page ? await toDashboardPage(result.page, this.readUrl) : null,
        addedSections: result.addedSections,
      };
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private async toDashboardWebsite<
    TWebsite extends { organizationId: string; theme: unknown; settings: unknown },
  >(website: TWebsite) {
    const settings = normalizeWebsiteSettings(website.settings);

    return {
      ...website,
      theme: normalizeWebsiteTheme(website.theme),
      settings: {
        ...settings,
        seo: {
          ...settings.seo,
          ogImageUrl: await this.readUrl(
            settings.seo.ogImageAssetId ?? null,
            website.organizationId,
          ),
        },
      },
    };
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
    if (error instanceof Error && error.message === 'WEBSITE_NOT_FOUND') {
      return new NotFoundException('Website not found');
    }
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      return new NotFoundException('Website not found');
    }

    return error;
  }
}
