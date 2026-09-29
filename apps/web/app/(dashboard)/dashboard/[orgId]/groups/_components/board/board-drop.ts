import type { OrganizationGroupMemberRole } from '@churchflow/shared';
import type {
  BoardDragSource,
  BoardDropIntent,
  BoardDropTarget,
  BoardMutation,
} from './board.types';

const NOOP: BoardDropIntent = { kind: 'noop' };

function mutate(mutation: BoardMutation, confirmPromotion: boolean): BoardDropIntent {
  return { kind: 'mutate', mutation, confirmPromotion };
}

/**
 * Decides what dropping a person somewhere on the board means. Only explicit zones mutate
 * anything, and every promotion to leader asks first; a demotion does not.
 *
 * `targetRole` is the role the person already holds in the target group, or null.
 */
export function resolveBoardDrop(input: {
  source: BoardDragSource;
  target: BoardDropTarget;
  copy: boolean;
  targetRole: OrganizationGroupMemberRole | null;
}): BoardDropIntent {
  const { source, target, copy, targetRole } = input;
  const membershipId = source.membershipId;

  if (target.kind === 'people') {
    if (source.kind === 'people') return NOOP;
    return mutate({ kind: 'remove', sourceGroupId: source.groupId, membershipId }, false);
  }

  const role: OrganizationGroupMemberRole = target.zone === 'leaders' ? 'LEADER' : 'MEMBER';
  const promotes = role === 'LEADER' && targetRole !== 'LEADER';

  if (source.kind === 'people') {
    return mutate({ kind: 'add', targetGroupId: target.groupId, membershipId, role }, promotes);
  }

  if (source.groupId === target.groupId) {
    if (source.role === role) return NOOP;
    return mutate({ kind: 'set-role', groupId: target.groupId, membershipId, role }, promotes);
  }

  if (!copy) {
    return mutate(
      {
        kind: 'move',
        sourceGroupId: source.groupId,
        targetGroupId: target.groupId,
        membershipId,
        role,
      },
      promotes,
    );
  }

  if (targetRole === role) return NOOP;
  // Already in the target: copying only changes the role there, and keeps their responsibility.
  if (targetRole !== null) {
    return mutate({ kind: 'set-role', groupId: target.groupId, membershipId, role }, promotes);
  }

  return mutate({ kind: 'copy', targetGroupId: target.groupId, membershipId, role }, promotes);
}
