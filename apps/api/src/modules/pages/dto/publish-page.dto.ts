import { publishWebsitePageSchema, type PublishWebsitePageInput } from '@churchflow/shared';

export class PublishPageDto implements PublishWebsitePageInput {
  static readonly schema = publishWebsitePageSchema;

  published!: boolean;
}
