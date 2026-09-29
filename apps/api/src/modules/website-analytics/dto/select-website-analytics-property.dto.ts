import {
  selectWebsiteAnalyticsPropertySchema,
  type SelectWebsiteAnalyticsPropertyInput,
} from '@churchflow/shared';

export class SelectWebsiteAnalyticsPropertyDto implements SelectWebsiteAnalyticsPropertyInput {
  static readonly schema = selectWebsiteAnalyticsPropertySchema;

  propertyId!: string;
  streamId!: string;
}
