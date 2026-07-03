const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createMemberPhotoUploadSchema,
  updateCurrentUserProfileSchema,
  updateOrganizationMemberProfileSchema,
} = require('@churchflow/shared');
const {
  MembershipsRepository,
} = require('../dist/modules/memberships/repositories/memberships.repository.js');

test('calendar profile dates reject future values', () => {
  assert.equal(
    updateCurrentUserProfileSchema.safeParse({ baptizedAt: '2999-01-01' }).success,
    false,
  );
  assert.equal(
    updateOrganizationMemberProfileSchema.safeParse({ memberSince: '2999-01-01' }).success,
    false,
  );
});

test('member photo declaration validates MIME type and five MB limit', () => {
  assert.equal(
    createMemberPhotoUploadSchema.safeParse({
      filename: 'photo.gif',
      mimeType: 'image/gif',
      byteSize: 100,
    }).success,
    false,
  );
  assert.equal(
    createMemberPhotoUploadSchema.safeParse({
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      byteSize: 5 * 1024 * 1024 + 1,
    }).success,
    false,
  );
});

test('relationships reject self links before persistence', async () => {
  const repository = new MembershipsRepository({
    $transaction: (callback) =>
      callback({
        organizationMember: {
          findFirst: async () => ({ id: 'manager' }),
          findMany: async () => [],
        },
      }),
  });
  await assert.rejects(
    repository.createRelationship({
      organizationId: 'organization',
      membershipId: 'same',
      relatedMembershipId: 'same',
      type: 'SPOUSE',
      actorUserId: 'manager',
    }),
    /SELF_RELATIONSHIP/,
  );
});
