import {
  addOrganizationGroupMembersSchema,
  createOrganizationGroupSchema,
  moveOrganizationGroupMemberSchema,
  saveOrganizationGroupBoardLayoutSchema,
  updateOrganizationGroupMemberSchema,
  updateOrganizationGroupSchema,
} from '@churchflow/shared';
import type {
  AddOrganizationGroupMembersInput,
  CreateOrganizationGroupInput,
  MoveOrganizationGroupMemberInput,
  OrganizationGroupIcon,
  SaveOrganizationGroupBoardLayoutInput,
  UpdateOrganizationGroupInput,
  UpdateOrganizationGroupMemberInput,
} from '@churchflow/shared';

export class CreateOrganizationGroupDto implements CreateOrganizationGroupInput {
  static readonly schema = createOrganizationGroupSchema;

  name!: string;
  description?: string | null;
  icon!: OrganizationGroupIcon;
  color!: string;
}

export class UpdateOrganizationGroupDto implements UpdateOrganizationGroupInput {
  static readonly schema = updateOrganizationGroupSchema;

  name?: string;
  description?: string | null;
  icon?: OrganizationGroupIcon;
  color?: string;
}

export class AddOrganizationGroupMembersDto implements AddOrganizationGroupMembersInput {
  static readonly schema = addOrganizationGroupMembersSchema;

  members!: AddOrganizationGroupMembersInput['members'];
}

export class UpdateOrganizationGroupMemberDto implements UpdateOrganizationGroupMemberInput {
  static readonly schema = updateOrganizationGroupMemberSchema;

  role?: UpdateOrganizationGroupMemberInput['role'];
  responsibility?: string | null;
}

export class MoveOrganizationGroupMemberDto implements MoveOrganizationGroupMemberInput {
  static readonly schema = moveOrganizationGroupMemberSchema;

  targetGroupId!: string;
  role!: MoveOrganizationGroupMemberInput['role'];
}

export class SaveOrganizationGroupBoardLayoutDto implements SaveOrganizationGroupBoardLayoutInput {
  static readonly schema = saveOrganizationGroupBoardLayoutSchema;

  nodes!: SaveOrganizationGroupBoardLayoutInput['nodes'];
}
