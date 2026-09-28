const assert = require('node:assert/strict');
const test = require('node:test');
const { NotFoundException } = require('@nestjs/common');
const { MediaService } = require('../dist/modules/media/media.service');
const { MediaRepository } = require('../dist/modules/media/repositories/media.repository');
const { MembershipsService } = require('../dist/modules/memberships/memberships.service');
const { privateMediaFile } = require('../dist/modules/media/private-media-file');
const { userAvatarUrl } = require('../dist/modules/media/user-avatar-url');

const ORGANIZATION_ID = '0b6f6c1e-9a47-4d0e-8a3c-2f1b3c4d5e6f';
const ASSET_ID = '6f1d2e3a-4b5c-4d6e-8f90-a1b2c3d4e5f6';
const USER_ID = 'user';

const storedPhoto = { bucket: 'bucket', objectKey: 'photo.webp', mimeType: 'image/webp' };

const config = {
  getOrThrow: (key) =>
    ({
      S3_BUCKET: 'bucket',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'access',
      S3_SECRET_ACCESS_KEY: 'secret',
      PUBLIC_API_URL: 'https://api.example.test',
    })[key],
};

function buildService({ asset = storedPhoto, s3Error = null } = {}) {
  const calls = { lookups: [], s3: [] };
  const repository = {
    findOrganizationVisibleImage: async (assetId, organizationId) => {
      calls.lookups.push({ assetId, organizationId });
      return asset;
    },
    findCurrentUserAvatar: async (assetId, userId) => {
      calls.lookups.push({ assetId, userId });
      return asset;
    },
  };
  const service = new MediaService(repository, {}, config);
  service.s3.send = async (command) => {
    calls.s3.push(command.input);
    if (s3Error) throw s3Error;
    return { Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } };
  };
  return { service, calls };
}

test('an organization photo is read from storage with its stored type', async () => {
  const { service, calls } = buildService();

  const media = await service.readOrganizationMedia(ORGANIZATION_ID, ASSET_ID);

  assert.deepEqual(calls.lookups, [{ assetId: ASSET_ID, organizationId: ORGANIZATION_ID }]);
  assert.deepEqual(calls.s3, [{ Bucket: 'bucket', Key: 'photo.webp' }]);
  assert.equal(media.mimeType, 'image/webp');
  assert.deepEqual([...media.body], [1, 2, 3]);
});

test('a photo the organization may not see is not found', async () => {
  const { service, calls } = buildService({ asset: null });

  await assert.rejects(
    service.readOrganizationMedia(ORGANIZATION_ID, ASSET_ID),
    (error) => error instanceof NotFoundException,
  );
  assert.equal(calls.s3.length, 0);
});

test('an asset reference that is not a uuid never reaches the database', async () => {
  const { service, calls } = buildService();

  await assert.rejects(
    service.readOrganizationMedia(ORGANIZATION_ID, 'not-a-uuid'),
    (error) => error instanceof NotFoundException,
  );
  await assert.rejects(
    service.readCurrentUserAvatar(USER_ID, '../other'),
    (error) => error instanceof NotFoundException,
  );
  assert.equal(calls.lookups.length, 0);
});

test('an object missing from storage is not found rather than a server error', async () => {
  const missing = Object.assign(new Error('The specified key does not exist.'), {
    name: 'NoSuchKey',
  });
  const { service } = buildService({ s3Error: missing });

  await assert.rejects(
    service.readOrganizationMedia(ORGANIZATION_ID, ASSET_ID),
    (error) => error instanceof NotFoundException,
  );
});

test('the current user avatar is looked up for that user only', async () => {
  const { service, calls } = buildService();

  await service.readCurrentUserAvatar(USER_ID, ASSET_ID);

  assert.deepEqual(calls.lookups, [{ assetId: ASSET_ID, userId: USER_ID }]);
});

test('a private photo may be kept by the browser only, for as long as its id lives', () => {
  const headers = {};
  const response = { setHeader: (name, value) => (headers[name] = value) };

  const file = privateMediaFile(
    { body: new Uint8Array([1, 2, 3]), mimeType: 'image/png' },
    response,
  );

  assert.equal(headers['Cache-Control'], 'private, max-age=31536000, immutable');
  assert.deepEqual(file.getHeaders(), {
    type: 'image/png',
    length: 3,
    disposition: undefined,
  });
});

test('the organization lookup admits its own images and the avatars of present members', async () => {
  let query;
  const repository = new MediaRepository({
    mediaAsset: {
      findFirst: async (args) => {
        query = args;
        return null;
      },
    },
  });

  await repository.findOrganizationVisibleImage(ASSET_ID, ORGANIZATION_ID);

  assert.deepEqual(query.where, {
    id: ASSET_ID,
    deletedAt: null,
    mimeType: { startsWith: 'image/' },
    OR: [
      { organizationId: ORGANIZATION_ID },
      {
        organizationId: null,
        userAvatar: {
          is: {
            deletedAt: null,
            memberships: { some: { organizationId: ORGANIZATION_ID, removedAt: null } },
          },
        },
      },
    ],
  });
});

test('the current user lookup admits only the avatar that user has now', async () => {
  let query;
  const repository = new MediaRepository({
    mediaAsset: {
      findFirst: async (args) => {
        query = args;
        return null;
      },
    },
  });

  await repository.findCurrentUserAvatar(ASSET_ID, USER_ID);

  assert.deepEqual(query.where, {
    id: ASSET_ID,
    deletedAt: null,
    userAvatar: { is: { id: USER_ID } },
  });
});

test('an uploaded avatar links to the organization route and a provider avatar stays as is', () => {
  assert.equal(
    userAvatarUrl(
      { avatarUrl: 'https://t.me/a.jpg', avatarAsset: { id: ASSET_ID } },
      ORGANIZATION_ID,
    ),
    `/v1/organizations/${ORGANIZATION_ID}/media/${ASSET_ID}/content`,
  );
  assert.equal(
    userAvatarUrl({ avatarUrl: 'https://t.me/a.jpg', avatarAsset: null }, ORGANIZATION_ID),
    'https://t.me/a.jpg',
  );
  assert.equal(userAvatarUrl(null, ORGANIZATION_ID), null);
});

test('the members list prefers the organization photo and links every photo stably', async () => {
  const member = (id, profilePhotoAssetId, user) => ({
    id,
    role: 'MEMBER',
    status: 'ACTIVE',
    source: 'MANUAL',
    groups: [],
    claimedAt: null,
    claims: [],
    profile: {
      displayName: id,
      notes: null,
      biography: null,
      familyNotes: null,
      profilePhotoAssetId,
    },
    user,
  });
  const avatarUser = {
    id: USER_ID,
    displayName: 'User',
    email: null,
    avatarUrl: 'https://t.me/a.jpg',
    avatarAsset: { id: 'user-avatar' },
    accounts: [],
  };
  const service = new MembershipsService(
    {
      listForOrganization: async () => ({
        candidates: [],
        counts: {},
        members: [
          member('with-photo', 'member-photo', avatarUser),
          member('avatar-only', null, avatarUser),
          member('provider-only', null, { ...avatarUser, avatarAsset: null }),
        ],
        nextCursor: null,
        page: 1,
        total: 3,
      }),
      findActiveMembership: async () => ({ id: 'with-photo', role: 'OWNER' }),
      listGroups: async () => [],
    },
    { listPendingForOrganization: async () => [] },
  );

  const payload = await service.listForOrganization(
    ORGANIZATION_ID,
    USER_ID,
    'all',
    'active',
    'all',
    '',
    [],
    1,
    20,
  );

  assert.deepEqual(
    payload.members.map((item) => item.profile.photoUrl),
    [
      `/v1/organizations/${ORGANIZATION_ID}/media/member-photo/content`,
      `/v1/organizations/${ORGANIZATION_ID}/media/user-avatar/content`,
      'https://t.me/a.jpg',
    ],
  );
});
