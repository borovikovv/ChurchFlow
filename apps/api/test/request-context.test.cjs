const assert = require('node:assert/strict');
const test = require('node:test');
const {
  RequestContextService,
} = require('../dist/common/context/request-context.service.js');

const USER_ID = '11111111-1111-1111-1111-111111111111';

test('there is no user and no system flag outside a request', () => {
  const context = new RequestContextService();

  assert.equal(context.userId, null);
  assert.equal(context.isSystem, false);
});

test('setting a user outside a request is ignored rather than throwing', () => {
  const context = new RequestContextService();

  context.setUserId(USER_ID);

  assert.equal(context.userId, null);
});

test('a request starts without a user until the guard supplies one', () => {
  const context = new RequestContextService();

  context.run(() => {
    assert.equal(context.userId, null);
    context.setUserId(USER_ID);
    assert.equal(context.userId, USER_ID);
  });
});

test('the user survives every await inside the request', async () => {
  const context = new RequestContextService();

  await context.run(async () => {
    context.setUserId(USER_ID);
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 1));
    assert.equal(context.userId, USER_ID);
  });
});

test('a system context carries the flag and no user', async () => {
  const context = new RequestContextService();

  await context.runAsSystem(async () => {
    await Promise.resolve();
    assert.equal(context.isSystem, true);
    assert.equal(context.userId, null);
  });
});

test('one request never sees the user of another running beside it', async () => {
  const context = new RequestContextService();
  const seen = [];

  const request = (userId, delayMs) =>
    context.run(async () => {
      context.setUserId(userId);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      seen.push(context.userId);
    });

  await Promise.all([request('user-a', 5), request('user-b', 1), context.runAsSystem(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3));
    seen.push(context.userId === null && context.isSystem ? 'system' : 'ПРОТІКЛО');
  })]);

  assert.deepEqual(seen.sort(), ['system', 'user-a', 'user-b']);
});

test('the context does not leak out of the request that set it', async () => {
  const context = new RequestContextService();

  await context.run(async () => {
    context.setUserId(USER_ID);
  });

  assert.equal(context.userId, null);
});
