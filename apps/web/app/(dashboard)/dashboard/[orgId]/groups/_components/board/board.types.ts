import type {
  OrganizationGroupBoardComputedNodeKey,
  OrganizationGroupBoardPerson,
  OrganizationGroupDetail,
  OrganizationGroupMemberRole,
} from '@churchflow/shared';
import type { Node } from '@xyflow/react';

export type BoardDropZone = 'leaders' | 'members';

export type BoardDragSource =
  | {
      kind: 'group';
      groupId: string;
      membershipId: string;
      role: OrganizationGroupMemberRole;
      displayName: string;
    }
  | {
      kind: 'people';
      nodeKey: OrganizationGroupBoardComputedNodeKey;
      membershipId: string;
      displayName: string;
    };

export type BoardDropTarget =
  | { kind: 'group'; groupId: string; zone: BoardDropZone }
  | { kind: 'people'; nodeKey: OrganizationGroupBoardComputedNodeKey };

export type BoardMutation =
  | {
      kind: 'move';
      sourceGroupId: string;
      targetGroupId: string;
      membershipId: string;
      role: OrganizationGroupMemberRole;
    }
  | {
      kind: 'copy' | 'add';
      targetGroupId: string;
      membershipId: string;
      role: OrganizationGroupMemberRole;
    }
  | { kind: 'remove'; sourceGroupId: string; membershipId: string }
  | {
      kind: 'set-role';
      groupId: string;
      membershipId: string;
      role: OrganizationGroupMemberRole;
    };

export type BoardDropIntent =
  | { kind: 'noop' }
  | { kind: 'mutate'; mutation: BoardMutation; confirmPromotion: boolean };

export interface BoardPoint {
  x: number;
  y: number;
}

export type GroupBoardNodeData = { group: OrganizationGroupDetail };

export type PeopleBoardNodeData = {
  nodeKey: OrganizationGroupBoardComputedNodeKey;
  people: OrganizationGroupBoardPerson[];
};

export type GroupBoardNode = Node<GroupBoardNodeData, 'group'>;
export type PeopleBoardNode = Node<PeopleBoardNodeData, 'people'>;
export type BoardNode = GroupBoardNode | PeopleBoardNode;

export interface PendingPromotion {
  mutation: BoardMutation;
  displayName: string;
  groupName: string;
}
