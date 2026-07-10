import { publishWebsiteSchema, type PublishWebsiteInput } from '@churchflow/shared';

export class PublishWebsiteDto implements PublishWebsiteInput {
  static readonly schema = publishWebsiteSchema;

  published!: boolean;
}
