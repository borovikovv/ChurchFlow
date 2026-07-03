import { createOrganizationMemberRelationshipSchema } from '@churchflow/shared';
import type { CreateOrganizationMemberRelationshipInput } from '@churchflow/shared';

export class CreateMemberRelationshipDto implements CreateOrganizationMemberRelationshipInput {
  static readonly schema = createOrganizationMemberRelationshipSchema;
  relatedMembershipId!: string;
  type!: CreateOrganizationMemberRelationshipInput['type'];
  notes?: string | null;
}
