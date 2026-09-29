import {
  setWebsiteAnalyticsMeasurementIdSchema,
  type SetWebsiteAnalyticsMeasurementIdInput,
} from '@churchflow/shared';

export class SetWebsiteAnalyticsMeasurementIdDto implements SetWebsiteAnalyticsMeasurementIdInput {
  static readonly schema = setWebsiteAnalyticsMeasurementIdSchema;

  measurementId!: string;
}
