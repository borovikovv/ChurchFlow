import { createManualOrganizationMemberSchema } from '@churchflow/shared';
import type { CreateManualOrganizationMemberInput } from '@churchflow/shared';

export class CreateManualMemberDto implements CreateManualOrganizationMemberInput {
  static readonly schema = createManualOrganizationMemberSchema;

  displayName!: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  role!: 'MEMBER' | 'VIEWER';
}
