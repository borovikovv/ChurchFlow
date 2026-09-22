import {
  upsertWebsitePageSchema,
  type UpsertWebsitePageInput,
  type WebsitePage,
  type WebsitePagePreset,
  type WebsiteSeo,
} from '@churchflow/shared';

export class UpsertPageDto implements UpsertWebsitePageInput {
  static readonly schema = upsertWebsitePageSchema;

  slug!: string;
  title!: string;
  status!: WebsitePage['status'];
  seo!: WebsiteSeo;
  preset?: WebsitePagePreset;
}
