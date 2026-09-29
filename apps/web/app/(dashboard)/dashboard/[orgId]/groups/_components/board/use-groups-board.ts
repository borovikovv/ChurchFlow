'use client';

import { applyNodeChanges, type NodeChange } from '@xyflow/react';
import { useState } from 'react';
import type {
  OrganizationGroupBoardNodePosition,
  OrganizationGroupBoardPayload,
  OrganizationGroupMemberRole,
} from '@churchflow/shared';
import {
  addGroupMembersAction,
  loadGroupBoardAction,
  moveGroupMemberAction,
  removeGroupMemberAction,
  saveGroupBoardLayoutAction,
  updateGroupMemberAction,
} from '../../actions';
import { resolveBoardDrop } from './board-drop';
import {
  autoPlacedBoardPositions,
  buildBoardNodes,
  currentBoardPositions,
  savedBoardPositions,
} from './board-nodes';
import type {
  BoardDragSource,
  BoardDropTarget,
  BoardMutation,
  BoardNode,
  PendingPromotion,
} from './board.types';

type ActionResult = { ok: true } | { ok: false; error: string };

function roleInGroup(
  payload: OrganizationGroupBoardPayload,
  groupId: string,
  membershipId: string,
): OrganizationGroupMemberRole | null {
  const group = payload.groups.find((item) => item.id === groupId);
  return group?.members.find((member) => member.membershipId === membershipId)?.role ?? null;
}

function groupName(payload: OrganizationGroupBoardPayload, groupId: string): string {
  return payload.groups.find((group) => group.id === groupId)?.name ?? '';
}

function nodePositions(nodes: readonly BoardNode[]): OrganizationGroupBoardNodePosition[] {
  return nodes.map((node) => ({ nodeKey: node.id, x: node.position.x, y: node.position.y }));
}

export function useGroupsBoard({
  initialPayload,
  organizationId,
}: {
  initialPayload: OrganizationGroupBoardPayload;
  organizationId: string;
}) {
  const [payload, setPayload] = useState(initialPayload);
  const [nodes, setNodes] = useState<BoardNode[]>(() =>
    buildBoardNodes(initialPayload, savedBoardPositions(initialPayload)),
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingMembershipIds, setPendingMembershipIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [promotion, setPromotion] = useState<PendingPromotion | null>(null);
  const [draggedSource, setDraggedSource] = useState<BoardDragSource | null>(null);
  const canManage = payload.canManage;

  const onNodesChange = (changes: NodeChange<BoardNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  };

  const saveLayout = async (positions: OrganizationGroupBoardNodePosition[]) => {
    if (!canManage || positions.length === 0) return;

    const result = await saveGroupBoardLayoutAction({
      organizationId,
      layout: { nodes: positions },
    });
    setError(result.ok ? null : result.error);
  };

  const saveDraggedNodes = (draggedNodes: readonly BoardNode[]) => {
    void saveLayout(nodePositions(draggedNodes));
  };

  const resetLayout = async () => {
    if (!canManage) return;

    const resetNodes = buildBoardNodes(payload, autoPlacedBoardPositions(payload), nodes);
    setNodes(resetNodes);
    await saveLayout(nodePositions(resetNodes));
  };

  const refresh = async () => {
    const result = await loadGroupBoardAction({ organizationId });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPayload(result.payload);
    setNodes((current) => buildBoardNodes(result.payload, currentBoardPositions(current), current));
  };

  const runMutation = async (mutation: BoardMutation): Promise<ActionResult> => {
    switch (mutation.kind) {
      case 'move':
        return moveGroupMemberAction({
          organizationId,
          groupId: mutation.sourceGroupId,
          membershipId: mutation.membershipId,
          move: { targetGroupId: mutation.targetGroupId, role: mutation.role },
        });
      case 'copy':
      case 'add':
        return addGroupMembersAction({
          organizationId,
          groupId: mutation.targetGroupId,
          members: [{ membershipId: mutation.membershipId, role: mutation.role }],
        });
      case 'remove':
        return removeGroupMemberAction({
          organizationId,
          groupId: mutation.sourceGroupId,
          membershipId: mutation.membershipId,
        });
      case 'set-role':
        return updateGroupMemberAction({
          organizationId,
          groupId: mutation.groupId,
          membershipId: mutation.membershipId,
          member: { role: mutation.role },
        });
    }
  };

  const applyMutation = async (mutation: BoardMutation) => {
    const { membershipId } = mutation;
    setPendingMembershipIds((current) => new Set(current).add(membershipId));

    const result = await runMutation(mutation);
    if (result.ok) {
      setError(null);
      await refresh();
    } else {
      setError(result.error);
    }

    setPendingMembershipIds((current) => {
      const next = new Set(current);
      next.delete(membershipId);
      return next;
    });
  };

  const dropOn = (target: BoardDropTarget, copy: boolean) => {
    const source = draggedSource;
    setDraggedSource(null);
    if (!canManage || !source || pendingMembershipIds.has(source.membershipId)) return;

    const intent = resolveBoardDrop({
      source,
      target,
      copy,
      targetRole:
        target.kind === 'group' ? roleInGroup(payload, target.groupId, source.membershipId) : null,
    });
    if (intent.kind === 'noop') return;

    if (intent.confirmPromotion && target.kind === 'group') {
      setPromotion({
        mutation: intent.mutation,
        displayName: source.displayName,
        groupName: groupName(payload, target.groupId),
      });
      return;
    }

    void applyMutation(intent.mutation);
  };

  const confirmPromotion = () => {
    if (!promotion) return;

    setPromotion(null);
    void applyMutation(promotion.mutation);
  };

  return {
    canManage,
    nodes,
    error,
    pendingMembershipIds,
    promotion,
    isDragging: draggedSource !== null,
    onNodesChange,
    saveDraggedNodes,
    resetLayout,
    startDrag: (source: BoardDragSource) => setDraggedSource(source),
    endDrag: () => setDraggedSource(null),
    dropOn,
    confirmPromotion,
    cancelPromotion: () => setPromotion(null),
  };
}

export type GroupsBoardController = ReturnType<typeof useGroupsBoard>;
