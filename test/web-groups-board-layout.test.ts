import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOARD_NODE_SIZE,
  placeBoardNodes,
} from '../apps/web/app/(dashboard)/dashboard/[orgId]/groups/_components/board/board-layout.ts';

function overlaps(left: { x: number; y: number }, right: { x: number; y: number }): boolean {
  return (
    Math.abs(left.x - right.x) < BOARD_NODE_SIZE.width &&
    Math.abs(left.y - right.y) < BOARD_NODE_SIZE.height
  );
}

function assertNoOverlap(positions: Map<string, { x: number; y: number }>) {
  const entries = [...positions.entries()];
  for (const [index, [leftKey, left]] of entries.entries()) {
    for (const [rightKey, right] of entries.slice(index + 1)) {
      assert.ok(!overlaps(left, right), `${leftKey} overlaps ${rightKey}`);
    }
  }
}

test('nodes without a saved position are placed on a grid without overlapping', () => {
  const keys = Array.from({ length: 11 }, (_, index) => `node-${index}`);
  const positions = placeBoardNodes(keys, new Map());

  assert.equal(positions.size, keys.length);
  assert.deepEqual(positions.get('node-0'), { x: 0, y: 0 });
  assertNoOverlap(positions);
});

test('saved positions are kept exactly and new nodes avoid them', () => {
  const saved = new Map([
    ['kept', { x: 0, y: 0 }],
    ['elsewhere', { x: 700, y: 20 }],
  ]);
  const positions = placeBoardNodes(['kept', 'new-a', 'elsewhere', 'new-b', 'new-c'], saved);

  assert.deepEqual(positions.get('kept'), { x: 0, y: 0 });
  assert.deepEqual(positions.get('elsewhere'), { x: 700, y: 20 });
  assertNoOverlap(positions);
});

test('placement is deterministic, so every viewer sees new groups in the same spot', () => {
  const saved = new Map([['kept', { x: 336, y: 0 }]]);
  const keys = ['kept', 'new-a', 'new-b'];

  assert.deepEqual(
    [...placeBoardNodes(keys, saved).entries()],
    [...placeBoardNodes(keys, saved).entries()],
  );
});

test('saved positions of nodes that are no longer on the board are ignored', () => {
  const positions = placeBoardNodes(['new'], new Map([['deleted-group', { x: 0, y: 0 }]]));

  assert.deepEqual([...positions.keys()], ['new']);
  assert.deepEqual(positions.get('new'), { x: 0, y: 0 });
});
