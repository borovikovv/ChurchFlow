import { reorderWebsiteSectionsSchema, type ReorderWebsiteSectionsInput } from '@churchflow/shared';

export class ReorderSectionsDto implements ReorderWebsiteSectionsInput {
  static readonly schema = reorderWebsiteSectionsSchema;

  sectionIds!: string[];
}
