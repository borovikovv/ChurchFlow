import { Injectable, NotFoundException } from '@nestjs/common';
import {
  uuidSchema,
  type ApplyWebsiteTemplateInput,
  type UpdateWebsiteSettingsInput,
} from '@churchflow/shared';
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
    publicWebsite.settings.seo.ogImageUrl = await this.publicReadUrl(
      publicWebsite.settings.seo.ogImageAssetId,
      website.organizationId,
    );
    publicWebsite.organization.logoUrl = await this.publicReadUrl(
      website.logoAssetId,
      website.organizationId,
    );

    return publicWebsite;
  }

  /**
   * Signs a read of media a published website still references. An id that is not a uuid cannot
   * name an asset, and answering it the same way as an unknown one keeps the route from telling a
   * caller anything about which ids exist.
   */
  async findPublicWebsiteMediaUrl(assetId: string): Promise<string> {
    const asset = uuidSchema.safeParse(assetId).success
      ? // Stored asset ids are lowercase uuids, and the JSON references are compared as text.
        await this.websitesRepository.findPublishedWebsiteAsset(assetId.toLowerCase())
      : null;
    if (!asset) throw new NotFoundException('Media asset was not found');

    return this.mediaService.signReadUrl(asset);
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

  // A dashboard response is read once, by a signed-in owner, so a short-lived signed url is both
  // enough and right: it shows unpublished content the public route refuses to serve.
  private readonly readUrl: ReadAssetUrl = async (assetId, organizationId) => {
    if (!assetId) return null;
    try {
      return (await this.mediaService.getReadUrl(assetId, organizationId)).url;
    } catch {
      return null;
    }
  };

  // The public site links to media instead of signing it: a presigned url is stale minutes later,
  // by which time a social unfurler or a lazily loaded background image is only starting to fetch.
  private readonly publicReadUrl: ReadAssetUrl = async (assetId, organizationId) => {
    if (!assetId) return null;
    try {
      return await this.mediaService.getPublicReadUrl(assetId, organizationId);
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
