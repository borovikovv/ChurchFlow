import { grantBillingExemptionSchema } from '@churchflow/shared';
import type { GrantBillingExemptionInput } from '@churchflow/shared';

export class GrantBillingExemptionDto implements GrantBillingExemptionInput {
  static readonly schema = grantBillingExemptionSchema;

  reason!: string;
}
