import {
  updateWebsiteSettingsSchema,
  type UpdateWebsiteSettingsInput,
  type WebsiteSettings,
  type WebsiteTheme,
} from '@churchflow/shared';

export class UpdateWebsiteSettingsDto implements UpdateWebsiteSettingsInput {
  static readonly schema = updateWebsiteSettingsSchema;

  title!: string;
  description?: string | undefined;
  theme!: WebsiteTheme;
  settings!: WebsiteSettings;
}
