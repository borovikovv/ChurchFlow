import { membershipClaimTokenSchema } from '@churchflow/shared';
import type { MembershipClaimTokenInput } from '@churchflow/shared';

export class MembershipClaimTokenDto implements MembershipClaimTokenInput {
  static readonly schema = membershipClaimTokenSchema;

  token!: string;
}
