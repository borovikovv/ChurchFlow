import { updateOrganizationMemberProfileSchema } from '@churchflow/shared';
import type { UpdateOrganizationMemberProfileInput } from '@churchflow/shared';

export class UpdateMemberProfileDto implements UpdateOrganizationMemberProfileInput {
  static readonly schema = updateOrganizationMemberProfileSchema;

  displayName?: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  memberSince?: string | null;
  birthday?: string | null;
  anniversary?: string | null;
  biography?: string | null;
  familyNotes?: string | null;
  groups?: UpdateOrganizationMemberProfileInput['groups'];
}
