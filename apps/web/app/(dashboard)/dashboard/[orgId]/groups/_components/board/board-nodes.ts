import {
  ORGANIZATION_GROUP_BOARD_COMPUTED_NODE_KEY,
  type OrganizationGroupBoardComputedNodeKey,
  type OrganizationGroupBoardPayload,
  type OrganizationGroupBoardPerson,
} from '@churchflow/shared';
import { placeBoardNodes } from './board-layout';
import type { BoardNode, BoardPoint } from './board.types';

export const GROUP_NODE_DRAG_HANDLE = '.board-node-handle';

function boardNodeKeys(payload: OrganizationGroupBoardPayload): string[] {
  return [
    ORGANIZATION_GROUP_BOARD_COMPUTED_NODE_KEY.unassigned,
    ORGANIZATION_GROUP_BOARD_COMPUTED_NODE_KEY.visitors,
    ...payload.groups.map((group) => group.id),
  ];
}

export function savedBoardPositions(
  payload: OrganizationGroupBoardPayload,
): Map<string, BoardPoint> {
  return new Map(payload.layout.map((node) => [node.nodeKey, { x: node.x, y: node.y }]));
}

export function currentBoardPositions(nodes: readonly BoardNode[]): Map<string, BoardPoint> {
  return new Map(nodes.map((node) => [node.id, node.position]));
}

export function autoPlacedBoardPositions(
  payload: OrganizationGroupBoardPayload,
): Map<string, BoardPoint> {
  return placeBoardNodes(boardNodeKeys(payload), new Map());
}

/**
 * Builds the nodes for a payload. Nodes that already exist keep their measured size and any
 * position in `positions`; nodes without a position are auto-placed around the others.
 */
export function buildBoardNodes(
  payload: OrganizationGroupBoardPayload,
  positions: ReadonlyMap<string, BoardPoint>,
  current: readonly BoardNode[] = [],
): BoardNode[] {
  const placed = placeBoardNodes(boardNodeKeys(payload), positions);
  const currentById = new Map(current.map((node) => [node.id, node]));
  const positionOf = (nodeKey: string): BoardPoint => placed.get(nodeKey) ?? { x: 0, y: 0 };
  const measuredSize = (nodeKey: string) => {
    const measured = currentById.get(nodeKey)?.measured;
    return measured ? { measured } : {};
  };

  const peopleNode = (
    nodeKey: OrganizationGroupBoardComputedNodeKey,
    people: OrganizationGroupBoardPerson[],
  ): BoardNode => ({
    id: nodeKey,
    type: 'people',
    position: positionOf(nodeKey),
    dragHandle: GROUP_NODE_DRAG_HANDLE,
    ...measuredSize(nodeKey),
    data: { nodeKey, people },
  });

  const peopleNodes = [
    peopleNode(ORGANIZATION_GROUP_BOARD_COMPUTED_NODE_KEY.unassigned, payload.unassignedMembers),
    peopleNode(ORGANIZATION_GROUP_BOARD_COMPUTED_NODE_KEY.visitors, payload.visitors),
  ];

  const groupNodes: BoardNode[] = payload.groups.map((group) => ({
    id: group.id,
    type: 'group',
    position: positionOf(group.id),
    dragHandle: GROUP_NODE_DRAG_HANDLE,
    ...measuredSize(group.id),
    data: { group },
  }));

  return [...peopleNodes, ...groupNodes];
}
