import {
  applyWebsiteTemplateSchema,
  type ApplyWebsiteTemplateInput,
  type WebsiteTemplateId,
} from '@churchflow/shared';

export class ApplyWebsiteTemplateDto implements ApplyWebsiteTemplateInput {
  static readonly schema = applyWebsiteTemplateSchema;

  templateId!: WebsiteTemplateId;
  addMissingSections!: boolean;
  resetTheme!: boolean;
}
