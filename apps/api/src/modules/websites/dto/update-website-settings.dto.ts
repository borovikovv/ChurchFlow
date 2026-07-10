import { updateWebsiteSettingsSchema, type UpdateWebsiteSettingsInput } from '@churchflow/shared';

export class UpdateWebsiteSettingsDto implements UpdateWebsiteSettingsInput {
  static readonly schema = updateWebsiteSettingsSchema;

  title!: string;
  description?: string | undefined;
  theme!: Record<string, unknown>;
  settings!: Record<string, unknown>;
}
