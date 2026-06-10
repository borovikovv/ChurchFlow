import { acceptInvitationSchema } from '@churchflow/shared';
import type { AcceptInvitationInput } from '@churchflow/shared';

export class AcceptInvitationDto implements AcceptInvitationInput {
  static readonly schema = acceptInvitationSchema;

  token!: string;
}
