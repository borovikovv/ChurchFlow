const assert = require('node:assert/strict');
const test = require('node:test');
const { confirmUserAvatarUploadSchema } = require('@churchflow/shared');
const { MediaService } = require('../dist/modules/media/media.service');
const { MediaRepository } = require('../dist/modules/media/repositories/media.repository');
const { UsersService } = require('../dist/modules/users/users.service');

const USER_ID = 'user';
const ORGANIZATION_ID = 'organization';
const MEMBERSHIP_ID = 'membership';
const ASSET_ID = 'avatar-asset';

const avatarAsset = {
  id: ASSET_ID,
  bucket: 'bucket',
  objectKey: `users/${USER_ID}/avatar/one.webp`,
  filename: 'me.webp',
  mimeType: 'image/webp',
  byteSize: 1234n,
  metadata: { status: 'pending', purpose: 'user-avatar', userId: USER_ID },
};

const config = {
  getOrThrow: (key) =>
    ({
      S3_BUCKET: 'bucket',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'access',
      S3_SECRET_ACCESS_KEY: 'secret',
    })[key],
};

function buildService({
  membershipWithoutPhoto = { id: MEMBERSHIP_ID },
  entitled = true,
  uploadedByteSize = Number(avatarAsset.byteSize),
  copyFails = false,
} = {}) {
  const calls = { attached: [], copied: [], s3: [] };
  const repository = {
    findUserAsset: async (assetId) => (assetId === ASSET_ID ? avatarAsset : null),
    attachUserAvatar: async (userId, assetId) => {
      calls.attached.push({ userId, assetId });
      return { assetId };
    },
    findMembershipWithoutPhoto: async () => membershipWithoutPhoto,
    attachCopiedMemberPhoto: async (data) => {
      calls.copied.push(data);
      return { assetId: 'copy', profileId: 'profile' };
    },
  };
  const entitlements = { has: async () => entitled };
  const service = new MediaService(repository, entitlements, config);
  service.logger = { error: () => {} };
  service.s3.send = async (command) => {
    calls.s3.push(command.constructor.name);
    if (command.constructor.name === 'CopyObjectCommand' && copyFails)
      throw new Error('S3 copy failed');
    return { ContentType: avatarAsset.mimeType, ContentLength: uploadedByteSize };
  };
  return { service, calls };
}

test('avatar confirmation accepts an optional organization to copy into', () => {
  const assetId = '6f1d2e3a-4b5c-4d6e-8f90-a1b2c3d4e5f6';
  assert.equal(confirmUserAvatarUploadSchema.safeParse({ assetId }).success, true);
  assert.equal(
    confirmUserAvatarUploadSchema.safeParse({ assetId, organizationId: 'not-a-uuid' }).success,
    false,
  );
});

test('confirming an avatar copies it to the membership that has no photo', async () => {
  const { service, calls } = buildService();

  const result = await service.confirmUserAvatar(USER_ID, {
    assetId: ASSET_ID,
    organizationId: ORGANIZATION_ID,
  });

  assert.deepEqual(calls.attached, [{ userId: USER_ID, assetId: ASSET_ID }]);
  assert.deepEqual(calls.s3, ['HeadObjectCommand', 'CopyObjectCommand']);
  assert.equal(calls.copied.length, 1);
  const copy = calls.copied[0];
  assert.equal(copy.organizationId, ORGANIZATION_ID);
  assert.equal(copy.membershipId, MEMBERSHIP_ID);
  assert.equal(copy.sourceAssetId, ASSET_ID);
  assert.equal(copy.actorUserId, USER_ID);
  assert.match(copy.objectKey, /^organizations\/organization\/members\/membership\/.+\.webp$/);
  assert.notEqual(copy.objectKey, avatarAsset.objectKey);
  assert.equal(result.copiedToMembershipId, MEMBERSHIP_ID);
  assert.equal(typeof result.avatarUrl, 'string');
});

test('a membership that already has a photo keeps it', async () => {
  const { service, calls } = buildService({ membershipWithoutPhoto: null });

  const result = await service.confirmUserAvatar(USER_ID, {
    assetId: ASSET_ID,
    organizationId: ORGANIZATION_ID,
  });

  assert.equal(calls.attached.length, 1);
  assert.deepEqual(calls.s3, ['HeadObjectCommand']);
  assert.equal(calls.copied.length, 0);
  assert.equal(result.copiedToMembershipId, null);
});

test('an organization without the upload entitlement receives no copy', async () => {
  const { service, calls } = buildService({ entitled: false });

  const result = await service.confirmUserAvatar(USER_ID, {
    assetId: ASSET_ID,
    organizationId: ORGANIZATION_ID,
  });

  assert.equal(calls.attached.length, 1);
  assert.equal(calls.copied.length, 0);
  assert.equal(result.copiedToMembershipId, null);
});

test('no organization means no copy', async () => {
  const { service, calls } = buildService();

  const result = await service.confirmUserAvatar(USER_ID, { assetId: ASSET_ID });

  assert.equal(calls.copied.length, 0);
  assert.equal(result.copiedToMembershipId, null);
});

test('a failed copy leaves the confirmed avatar in place and reports no copy', async () => {
  const { service, calls } = buildService({ copyFails: true });

  const result = await service.confirmUserAvatar(USER_ID, {
    assetId: ASSET_ID,
    organizationId: ORGANIZATION_ID,
  });

  assert.equal(calls.attached.length, 1);
  assert.equal(calls.copied.length, 0);
  assert.equal(result.copiedToMembershipId, null);
  assert.equal(typeof result.avatarUrl, 'string');
});

test('an upload that does not match its declaration is refused', async () => {
  const { service, calls } = buildService({ uploadedByteSize: 1 });

  await assert.rejects(
    service.confirmUserAvatar(USER_ID, { assetId: ASSET_ID }),
    /does not match the declared avatar/,
  );
  assert.equal(calls.attached.length, 0);
});

test("another user's pending avatar cannot be confirmed", async () => {
  const { service, calls } = buildService();

  await assert.rejects(
    service.confirmUserAvatar('someone-else', { assetId: ASSET_ID }),
    /Pending avatar asset was not found/,
  );
  assert.equal(calls.attached.length, 0);
});

test('attaching a new avatar retires the previous one', async () => {
  const updates = [];
  const tx = {
    user: {
      findUniqueOrThrow: async () => ({ avatarAssetId: 'previous' }),
      update: async ({ data }) => updates.push({ user: data }),
    },
    mediaAsset: { update: async ({ where, data }) => updates.push({ asset: where.id, data }) },
  };
  const repository = new MediaRepository({ $transaction: async (callback) => callback(tx) });

  await repository.attachUserAvatar(USER_ID, ASSET_ID);

  assert.deepEqual(updates[0], { user: { avatarAssetId: ASSET_ID } });
  assert.equal(updates[1].asset, ASSET_ID);
  assert.equal(updates[1].data.metadata.status, 'confirmed');
  assert.equal(updates[2].asset, 'previous');
  assert.ok(updates[2].data.deletedAt instanceof Date);
});

test('the current user profile prefers the uploaded avatar over the provider URL', async () => {
  const mediaService = { signReadUrl: async (asset) => `signed:${asset.objectKey}` };
  const withAsset = new UsersService(
    {
      findById: async () => ({
        id: USER_ID,
        avatarUrl: 'https://t.me/photo.jpg',
        avatarAsset: { bucket: 'bucket', objectKey: 'users/user/avatar/one.webp' },
      }),
    },
    mediaService,
  );
  const withoutAsset = new UsersService(
    {
      findById: async () => ({
        id: USER_ID,
        avatarUrl: 'https://t.me/photo.jpg',
        avatarAsset: null,
      }),
    },
    mediaService,
  );

  const uploaded = await withAsset.findProfile(USER_ID);
  const provider = await withoutAsset.findProfile(USER_ID);

  assert.equal(uploaded.avatarUrl, 'signed:users/user/avatar/one.webp');
  assert.equal('avatarAsset' in uploaded, false);
  assert.equal(provider.avatarUrl, 'https://t.me/photo.jpg');
});

test('removing the avatar clears the provider URL and retires the asset', async () => {
  const updates = [];
  const tx = {
    user: {
      findUniqueOrThrow: async () => ({ avatarAssetId: ASSET_ID }),
      update: async ({ data }) => updates.push({ user: data }),
    },
    mediaAsset: { update: async ({ where, data }) => updates.push({ asset: where.id, data }) },
  };
  const repository = new MediaRepository({ $transaction: async (callback) => callback(tx) });

  await repository.clearUserAvatar(USER_ID);

  assert.deepEqual(updates[0], { user: { avatarAssetId: null, avatarUrl: null } });
  assert.equal(updates[1].asset, ASSET_ID);
  assert.ok(updates[1].data.deletedAt instanceof Date);
});
