import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBoardDrop } from '../apps/web/app/(dashboard)/dashboard/[orgId]/groups/_components/board/board-drop.ts';

const MEMBERSHIP_ID = 'membership';

const fromGroup = (groupId: string, role: 'LEADER' | 'MEMBER' = 'MEMBER') => ({
  kind: 'group' as const,
  groupId,
  membershipId: MEMBERSHIP_ID,
  role,
  displayName: 'Anna',
});

const fromPeople = (nodeKey: 'unassigned' | 'visitors') => ({
  kind: 'people' as const,
  nodeKey,
  membershipId: MEMBERSHIP_ID,
  displayName: 'Anna',
});

const onGroup = (groupId: string, zone: 'leaders' | 'members') => ({
  kind: 'group' as const,
  groupId,
  zone,
});

test('dropping into another group moves, and Alt copies', () => {
  assert.deepEqual(
    resolveBoardDrop({
      source: fromGroup('a'),
      target: onGroup('b', 'members'),
      copy: false,
      targetRole: null,
    }),
    {
      kind: 'mutate',
      confirmPromotion: false,
      mutation: {
        kind: 'move',
        sourceGroupId: 'a',
        targetGroupId: 'b',
        membershipId: MEMBERSHIP_ID,
        role: 'MEMBER',
      },
    },
  );
  assert.deepEqual(
    resolveBoardDrop({
      source: fromGroup('a'),
      target: onGroup('b', 'members'),
      copy: true,
      targetRole: null,
    }),
    {
      kind: 'mutate',
      confirmPromotion: false,
      mutation: { kind: 'copy', targetGroupId: 'b', membershipId: MEMBERSHIP_ID, role: 'MEMBER' },
    },
  );
});

test('people without a group are added to the group they are dropped on', () => {
  for (const nodeKey of ['unassigned', 'visitors'] as const) {
    assert.deepEqual(
      resolveBoardDrop({
        source: fromPeople(nodeKey),
        target: onGroup('b', 'members'),
        copy: false,
        targetRole: null,
      }),
      {
        kind: 'mutate',
        confirmPromotion: false,
        mutation: { kind: 'add', targetGroupId: 'b', membershipId: MEMBERSHIP_ID, role: 'MEMBER' },
      },
    );
  }
});

test('dropping a group member on a computed node removes them from that group', () => {
  assert.deepEqual(
    resolveBoardDrop({
      source: fromGroup('a', 'LEADER'),
      target: { kind: 'people', nodeKey: 'unassigned' },
      copy: false,
      targetRole: null,
    }),
    {
      kind: 'mutate',
      confirmPromotion: false,
      mutation: { kind: 'remove', sourceGroupId: 'a', membershipId: MEMBERSHIP_ID },
    },
  );
});

test('every drop on a leaders zone asks first', () => {
  const cases = [
    { source: fromGroup('a'), target: onGroup('a', 'leaders'), kind: 'set-role' },
    { source: fromGroup('a'), target: onGroup('b', 'leaders'), kind: 'move' },
    { source: fromPeople('unassigned'), target: onGroup('b', 'leaders'), kind: 'add' },
  ];

  for (const { source, target, kind } of cases) {
    const intent = resolveBoardDrop({ source, target, copy: false, targetRole: null });
    assert.equal(intent.kind, 'mutate');
    if (intent.kind !== 'mutate') continue;
    assert.equal(intent.confirmPromotion, true);
    assert.equal(intent.mutation.kind, kind);
    assert.ok('role' in intent.mutation && intent.mutation.role === 'LEADER');
  }
});

test('a leader dropped on the members zone of the same group is demoted without asking', () => {
  assert.deepEqual(
    resolveBoardDrop({
      source: fromGroup('a', 'LEADER'),
      target: onGroup('a', 'members'),
      copy: false,
      targetRole: 'LEADER',
    }),
    {
      kind: 'mutate',
      confirmPromotion: false,
      mutation: { kind: 'set-role', groupId: 'a', membershipId: MEMBERSHIP_ID, role: 'MEMBER' },
    },
  );
});

test('dropping onto the place a person already holds does nothing', () => {
  const noop = { kind: 'noop' };

  assert.deepEqual(
    resolveBoardDrop({
      source: fromGroup('a'),
      target: onGroup('a', 'members'),
      copy: false,
      targetRole: 'MEMBER',
    }),
    noop,
  );
  assert.deepEqual(
    resolveBoardDrop({
      source: fromGroup('a', 'LEADER'),
      target: onGroup('a', 'leaders'),
      copy: false,
      targetRole: 'LEADER',
    }),
    noop,
  );
  assert.deepEqual(
    resolveBoardDrop({
      source: fromPeople('visitors'),
      target: { kind: 'people', nodeKey: 'unassigned' },
      copy: false,
      targetRole: null,
    }),
    noop,
  );
  assert.deepEqual(
    resolveBoardDrop({
      source: fromGroup('a'),
      target: onGroup('b', 'members'),
      copy: true,
      targetRole: 'MEMBER',
    }),
    noop,
  );
});

test('copying someone already in the target only changes their role there', () => {
  assert.deepEqual(
    resolveBoardDrop({
      source: fromGroup('a'),
      target: onGroup('b', 'leaders'),
      copy: true,
      targetRole: 'MEMBER',
    }),
    {
      kind: 'mutate',
      confirmPromotion: true,
      mutation: { kind: 'set-role', groupId: 'b', membershipId: MEMBERSHIP_ID, role: 'LEADER' },
    },
  );
});

test('a leader of the target keeps leading it when moved into its members zone from elsewhere', () => {
  assert.deepEqual(
    resolveBoardDrop({
      source: fromGroup('a'),
      target: onGroup('b', 'members'),
      copy: false,
      targetRole: 'LEADER',
    }),
    {
      kind: 'mutate',
      confirmPromotion: false,
      mutation: {
        kind: 'move',
        sourceGroupId: 'a',
        targetGroupId: 'b',
        membershipId: MEMBERSHIP_ID,
        role: 'LEADER',
      },
    },
  );
  assert.deepEqual(
    resolveBoardDrop({
      source: fromGroup('a'),
      target: onGroup('b', 'members'),
      copy: true,
      targetRole: 'LEADER',
    }),
    { kind: 'noop' },
  );
});

test('moving onto the leaders of a group someone already leads needs no confirmation', () => {
  const intent = resolveBoardDrop({
    source: fromGroup('a'),
    target: onGroup('b', 'leaders'),
    copy: false,
    targetRole: 'LEADER',
  });

  assert.equal(intent.kind === 'mutate' && intent.confirmPromotion, false);
});
