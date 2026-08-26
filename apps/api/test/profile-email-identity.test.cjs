const assert = require('node:assert/strict');
const test = require('node:test');
const { UsersRepository } = require('../dist/modules/users/repositories/users.repository.js');

const USER_ID = 'b919dd9a-12d5-4460-b0e2-f22f85ca507b';

function createRepository(currentEmail, accounts = ['email', 'telegram']) {
  const deletedAccounts = [];
  const updates = [];

  const transaction = {
    user: {
      findUniqueOrThrow: async () => ({ email: currentEmail }),
      update: async (args) => {
        updates.push(args);
        return { id: USER_ID, ...args.data };
      },
    },
    authAccount: {
      count: async ({ where }) =>
        accounts.filter((provider) =>
          where.provider === 'email' ? provider === 'email' : provider !== 'email',
        ).length,
      deleteMany: async (args) => {
        deletedAccounts.push(args.where);
        return { count: 1 };
      },
    },
  };

  const repository = new UsersRepository({
    $transaction: async (run) => run(transaction),
  });

  return { repository, deletedAccounts, updates };
}

test('changing the address withdraws the confirmation and the sign-in method built on it', async () => {
  const { repository, deletedAccounts, updates } = createRepository('old@example.com');

  await repository.updateProfile(USER_ID, { email: 'new@example.com' });

  assert.deepEqual(deletedAccounts, [{ userId: USER_ID, provider: 'email' }]);
  assert.equal(updates[0].data.email, 'new@example.com');
  assert.equal(updates[0].data.emailVerified, null);
});

test('clearing the address withdraws the confirmation too', async () => {
  const { repository, deletedAccounts, updates } = createRepository('old@example.com');

  await repository.updateProfile(USER_ID, { email: null });

  assert.deepEqual(deletedAccounts, [{ userId: USER_ID, provider: 'email' }]);
  assert.equal(updates[0].data.email, null);
  assert.equal(updates[0].data.emailVerified, null);
});

test('resaving the same address in a different case is not a change', async () => {
  const { repository, deletedAccounts, updates } = createRepository('member@example.com');

  await repository.updateProfile(USER_ID, { email: 'Member@Example.COM' });

  assert.deepEqual(deletedAccounts, []);
  assert.equal('emailVerified' in updates[0].data, false);
});

test('editing an unrelated field leaves the confirmed address alone', async () => {
  const { repository, deletedAccounts, updates } = createRepository('member@example.com');

  await repository.updateProfile(USER_ID, { displayName: 'Renamed' });

  assert.deepEqual(deletedAccounts, []);
  assert.equal('email' in updates[0].data, false);
  assert.equal('emailVerified' in updates[0].data, false);
});

test('adding a first address to an account that had none is still a change', async () => {
  const { repository, deletedAccounts, updates } = createRepository(null);

  await repository.updateProfile(USER_ID, { email: 'member@example.com' });

  assert.deepEqual(deletedAccounts, [{ userId: USER_ID, provider: 'email' }]);
  assert.equal(updates[0].data.emailVerified, null);
});

test('the address cannot be given up while it is the only way back in', async () => {
  const { repository, deletedAccounts, updates } = createRepository('member@example.com', [
    'email',
  ]);

  await assert.rejects(
    repository.updateProfile(USER_ID, { email: 'new@example.com' }),
    /LAST_SIGN_IN_METHOD/,
  );
  assert.deepEqual(deletedAccounts, []);
  assert.deepEqual(updates, []);
});

test('clearing the only address is refused for the same reason', async () => {
  const { repository } = createRepository('member@example.com', ['email']);

  await assert.rejects(repository.updateProfile(USER_ID, { email: null }), /LAST_SIGN_IN_METHOD/);
});

test('a passkey is enough of a fallback to let the address change', async () => {
  const { repository, deletedAccounts } = createRepository('member@example.com', [
    'email',
    'passkey',
  ]);

  await repository.updateProfile(USER_ID, { email: 'new@example.com' });

  assert.deepEqual(deletedAccounts, [{ userId: USER_ID, provider: 'email' }]);
});

test('an address nobody ever confirmed is not a way back in, so it may change freely', async () => {
  const { repository, updates } = createRepository('typo@example.com', []);

  await repository.updateProfile(USER_ID, { email: 'correct@example.com' });

  assert.equal(updates[0].data.email, 'correct@example.com');
});
