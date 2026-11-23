import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error plain .mjs helper without type declarations
import * as core from '../scripts/mobile-agent/todoist-core.mjs';

type Task = { id: string; content: string; description: string; labels: string[] };

function task(id: string, content: string, deps: string, labels: string[] = ['mobile']): Task {
  return { id, content, description: `Something to do.\nDepends on: ${deps}`, labels };
}

test('reads ticket ids and dependencies', () => {
  assert.equal(core.ticketIdOf('M-04 API client'), 'M-04');
  assert.equal(core.ticketIdOf('Fix the login'), null);
  assert.deepEqual(core.dependenciesOf('x\nDepends on: M-04, M-05, M-11'), [
    'M-04',
    'M-05',
    'M-11',
  ]);
  assert.deepEqual(core.dependenciesOf('Depends on: —'), []);
  assert.deepEqual(
    core.dependenciesOf('Depends on: M-01 (Android assetlinks part can wait for M-02)'),
    ['M-01', 'M-02'],
  );
});

test('picks the lowest ready ticket and skips manual, taken and blocked ones', () => {
  const tasks = [
    task('1', 'M-01 Enroll in Apple Developer Program', '—', ['mobile', 'manual']),
    task('3', 'M-03 Scaffold', '—', ['mobile', 'review']),
    task('4', 'M-04 API client', 'M-03'),
    task('8', 'M-08 E2E stack', '—', ['mobile', 'blocked']),
    task('11', 'M-11 API email code', '—'),
    task('12', 'M-12 Mobile sign-in', 'M-04, M-11'),
    task('99', 'Unrelated', '—'),
  ];
  const ready = core.readyTickets(tasks).map((entry: { id: string }) => entry.id);
  assert.deepEqual(ready, ['M-11']);
  assert.equal(core.pickTicket(tasks).id, 'M-11');
});

test('a ticket becomes ready once its dependencies are closed', () => {
  const tasks = [task('4', 'M-04 API client', 'M-03'), task('5', 'M-05 Design tokens', 'M-03')];
  assert.deepEqual(
    core.readyTickets(tasks).map((entry: { id: string }) => entry.id),
    ['M-04', 'M-05'],
  );
});

test('an explicitly requested ticket must exist and be ready', () => {
  const tasks = [task('4', 'M-04 API client', 'M-03'), task('12', 'M-12 Mobile sign-in', 'M-04')];
  assert.equal(core.pickTicket(tasks, 'm-04').id, 'M-04');
  assert.match(core.pickTicket(tasks, 'M-12').error, /not ready/);
  assert.match(core.pickTicket(tasks, 'M-77').error, /No open ticket/);
});

test('builds branch names and maps them back to tickets', () => {
  const branch = core.branchNameFor(
    'M-04',
    'M-04 API client, TanStack Query and environment config',
  );
  assert.equal(
    core.branchNameFor(
      'M-16',
      'M-16 API + web: passkeys for native clients and a very long tail of words',
    ),
    'mobile/m-16-api-web-passkeys-for-native-clients-and-a-very',
  );
  assert.equal(branch, 'mobile/m-04-api-client-tanstack-query-and-environment-config');
  assert.equal(core.ticketIdFromBranch(branch), 'M-04');
  assert.equal(core.ticketIdFromBranch('feature/login'), null);
});

test('label changes keep unrelated labels', () => {
  assert.deepEqual(core.withLabels(['mobile', 'in-progress'], ['review'], ['in-progress']), [
    'mobile',
    'review',
  ]);
});
