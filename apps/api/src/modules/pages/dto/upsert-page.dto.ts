import {
  upsertWebsitePageSchema,
  type UpsertWebsitePageInput,
  type WebsitePage,
} from '@churchflow/shared';

export class UpsertPageDto implements UpsertWebsitePageInput {
  static readonly schema = upsertWebsitePageSchema;

  slug!: string;
  title!: string;
  status!: WebsitePage['status'];
  seo!: Record<string, unknown>;
}
