import {
  websiteAnalyticsReportQuerySchema,
  type WebsiteAnalyticsReportQuery,
  type WebsiteAnalyticsReportRange,
} from '@churchflow/shared';

export class WebsiteAnalyticsReportQueryDto implements WebsiteAnalyticsReportQuery {
  static readonly schema = websiteAnalyticsReportQuerySchema;

  range!: WebsiteAnalyticsReportRange;
}
