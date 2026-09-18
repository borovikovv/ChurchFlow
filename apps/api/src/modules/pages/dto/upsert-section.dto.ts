import {
  upsertWebsiteSectionSchema,
  type UpsertWebsiteSectionInput,
  type WebsiteSection,
} from '@churchflow/shared';

export class UpsertSectionDto implements UpsertWebsiteSectionInput {
  static readonly schema = upsertWebsiteSectionSchema;

  type!: WebsiteSection['type'];
  order!: number;
  hidden!: boolean;
  content!: Record<string, unknown>;
}
