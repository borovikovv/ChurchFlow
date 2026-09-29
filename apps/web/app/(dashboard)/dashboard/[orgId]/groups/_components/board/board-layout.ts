import type { BoardPoint } from './board.types';

/** The footprint reserved for every node; node lists scroll inside it. */
export const BOARD_NODE_SIZE = { width: 288, height: 440 } as const;

const BOARD_NODE_GAP = 48;
const BOARD_GRID_COLUMNS = 4;

function overlaps(left: BoardPoint, right: BoardPoint): boolean {
  return (
    Math.abs(left.x - right.x) < BOARD_NODE_SIZE.width + BOARD_NODE_GAP &&
    Math.abs(left.y - right.y) < BOARD_NODE_SIZE.height + BOARD_NODE_GAP
  );
}

function gridCell(index: number): BoardPoint {
  const column = index % BOARD_GRID_COLUMNS;
  const row = Math.floor(index / BOARD_GRID_COLUMNS);

  return {
    x: column * (BOARD_NODE_SIZE.width + BOARD_NODE_GAP),
    y: row * (BOARD_NODE_SIZE.height + BOARD_NODE_GAP),
  };
}

/**
 * Keeps every saved position and places the remaining nodes, in order, into the first free cells
 * of a grid, so a new group never lands on top of a node someone has already arranged.
 */
export function placeBoardNodes(
  nodeKeys: readonly string[],
  saved: ReadonlyMap<string, BoardPoint>,
): Map<string, BoardPoint> {
  const placed = new Map<string, BoardPoint>();
  for (const nodeKey of nodeKeys) {
    const position = saved.get(nodeKey);
    if (position) placed.set(nodeKey, position);
  }

  const occupied = [...placed.values()];
  let cellIndex = 0;
  for (const nodeKey of nodeKeys) {
    if (placed.has(nodeKey)) continue;

    let cell = gridCell(cellIndex);
    while (occupied.some((position) => overlaps(position, cell))) {
      cellIndex += 1;
      cell = gridCell(cellIndex);
    }

    placed.set(nodeKey, cell);
    occupied.push(cell);
    cellIndex += 1;
  }

  return placed;
}
