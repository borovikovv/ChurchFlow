import assert from 'node:assert/strict';
import test from 'node:test';
import {
  emptyServiceRoleGroups,
  serviceRoleCandidateGroupIds,
  serviceRoleCandidateSections,
} from '../packages/shared/dist/index.js';

const PREACHERS = { id: 'preachers', name: 'Preachers', icon: 'preaching', color: '#C4B5FD' };
const ELDERS = { id: 'elders', name: 'Elders', icon: 'leadership', color: '#FCD34D' };
const CHOIR = { id: 'choir', name: 'Choir', icon: 'choir', color: '#6EE7B7' };

function person(displayName: string, groups: Array<Record<string, string>> = []) {
  return { id: displayName.toLowerCase(), displayName, groups };
}

const anna = person('Anna');
const ivan = person('Ivan', [
  { ...PREACHERS, role: 'MEMBER' },
  { ...ELDERS, role: 'LEADER' },
]);
const oleh = person('Oleh', [{ ...PREACHERS, role: 'LEADER' }]);
const petro = person('Petro', [{ ...ELDERS, role: 'MEMBER' }]);
const vira = person('Vira', [{ ...CHOIR, role: 'MEMBER' }]);
const people = [vira, petro, oleh, ivan, anna];

function names(section: { members: Array<{ displayName: string }> }) {
  return section.members.map((member) => member.displayName);
}

test('linked groups come first, one block each, leaders first, everyone else after', () => {
  const roles = { ...emptyServiceRoleGroups(), PREACHER: ['preachers', 'elders'] };
  const sections = serviceRoleCandidateSections(people, 'PREACHER', roles);

  assert.deepEqual(
    sections.map((section) => section.group?.id ?? null),
    ['preachers', 'elders', null],
  );
  assert.deepEqual(names(sections[0]), ['Oleh', 'Ivan']);
  // Ivan leads the elders but already shows among the preachers, so he is not repeated.
  assert.deepEqual(names(sections[1]), ['Petro']);
  assert.deepEqual(names(sections[2]), ['Anna', 'Vira']);
  assert.equal('role' in (sections[0].group ?? {}), false);
});

test('without linked groups the fallback icons order a single block', () => {
  const sections = serviceRoleCandidateSections(people, 'SERVICE_HOST', emptyServiceRoleGroups());

  assert.equal(sections.length, 1);
  assert.equal(sections[0].group, null);
  // Host falls back to leadership, then deacons, then teaching groups.
  assert.deepEqual(names(sections[0]), ['Ivan', 'Petro', 'Anna', 'Oleh', 'Vira']);
});

test('linked groups without members leave one block by name', () => {
  const roles = { ...emptyServiceRoleGroups(), PREACHER: ['empty-group'] };
  const sections = serviceRoleCandidateSections(people, 'PREACHER', roles);

  assert.deepEqual(
    sections.map((section) => [section.group, names(section)]),
    [[null, ['Anna', 'Ivan', 'Oleh', 'Petro', 'Vira']]],
  );
});

test('candidate groups are the linked ones, or the fallback icons while none is linked', () => {
  const groups = [
    { id: 'preachers', icon: 'preaching', serviceRoles: [] },
    { id: 'youth', icon: 'youth', serviceRoles: ['PREACHER'] },
    { id: 'elders', icon: 'leadership', serviceRoles: [] },
  ];

  assert.deepEqual(serviceRoleCandidateGroupIds('PREACHER', groups), ['youth']);
  assert.deepEqual(serviceRoleCandidateGroupIds('SERVICE_HOST', groups), ['elders']);
  assert.deepEqual(serviceRoleCandidateGroupIds('SOUND_ENGINEER', groups), []);
});
