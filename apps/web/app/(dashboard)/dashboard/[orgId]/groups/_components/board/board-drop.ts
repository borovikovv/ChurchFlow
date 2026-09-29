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

  if (source.kind === 'people') {
    const role = target.zone === 'leaders' ? 'LEADER' : 'MEMBER';
    return mutate(
      { kind: 'add', targetGroupId: target.groupId, membershipId, role },
      role === 'LEADER',
    );
  }

  if (source.groupId === target.groupId) {
    const role = target.zone === 'leaders' ? 'LEADER' : 'MEMBER';
    if (source.role === role) return NOOP;
    return mutate(
      { kind: 'set-role', groupId: target.groupId, membershipId, role },
      role === 'LEADER',
    );
  }

  // Only a drop inside the same group demotes. Someone who already leads the target group stays
  // a leader when they arrive in its members zone from elsewhere.
  const role: OrganizationGroupMemberRole =
    target.zone === 'leaders' ? 'LEADER' : (targetRole ?? 'MEMBER');
  const promotes = role === 'LEADER' && targetRole !== 'LEADER';

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
